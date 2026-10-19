import {
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AccessTokenGuard } from '../src/auth/access-token.guard.js';
import { RolesGuard } from '../src/auth/roles.guard.js';
import { UserRole } from '../src/common/enums/auth.enum.js';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter.js';
import { InventoryController } from '../src/inventory/inventory.controller.js';
import { InventoryService } from '../src/inventory/inventory.service.js';

const TEST_SECRET = 'inventory-e2e-access-secret-at-least-32-characters';
const SELLER_ID = '6ad241c4518543c0e9ca45c7';
const PRODUCT_ID = '6ad2522633589a8263596d5d';
const responseBody = { items: [] };

describe('Inventory controller HTTP and Swagger contract (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let service: {
    findAll: ReturnType<typeof vi.fn>;
    findMine: ReturnType<typeof vi.fn>;
    findByProductId: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    updateQuantity: ReturnType<typeof vi.fn>;
  };

  beforeAll(async () => {
    service = {
      findAll: vi.fn().mockResolvedValue(responseBody),
      findMine: vi.fn().mockResolvedValue(responseBody),
      findByProductId: vi.fn().mockResolvedValue(responseBody),
      create: vi.fn().mockResolvedValue(responseBody),
      updateQuantity: vi.fn().mockResolvedValue(responseBody),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [InventoryController],
      providers: [
        AccessTokenGuard,
        RolesGuard,
        { provide: InventoryService, useValue: service },
        {
          provide: ConfigService,
          useValue: { getOrThrow: vi.fn().mockReturnValue(TEST_SECRET) },
        },
      ],
    }).compile();

    jwtService = moduleRef.get(JwtService);
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    for (const method of Object.values(service)) {
      method.mockClear();
      method.mockResolvedValue(responseBody);
    }
  });

  async function tokenFor(
    role: UserRole,
    expirationOffsetSeconds?: number,
  ): Promise<string> {
    return jwtService.signAsync(
      {
        sub: SELLER_ID,
        type: 'access',
        role,
        ...(expirationOffsetSeconds !== undefined && {
          exp: Math.floor(Date.now() / 1000) + expirationOffsetSeconds,
        }),
      },
      { secret: TEST_SECRET },
    );
  }

  it('documents integer limit/skip query parameters for both list routes', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );

    for (const path of ['/inventory', '/inventory/me']) {
      const parameters = document.paths[path]?.get?.parameters ?? [];
      expect(parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'limit',
            in: 'query',
            schema: expect.objectContaining({
              type: 'integer',
              default: 20,
              minimum: 1,
              maximum: 100,
            }),
          }),
          expect.objectContaining({
            name: 'skip',
            in: 'query',
            schema: expect.objectContaining({
              type: 'integer',
              default: 0,
              minimum: 0,
            }),
          }),
        ]),
      );
    }
  });

  it('documents inventory ObjectId parameters and integer quantity bodies', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    const productPathParameter = document.paths[
      '/inventory/{productId}'
    ]?.get?.parameters?.[0];

    expect(productPathParameter).toMatchObject({
      name: 'productId',
      in: 'path',
      schema: {
        type: 'string',
        pattern: '^[0-9a-fA-F]{24}$',
      },
    });
    expect(
      document.components?.schemas?.CreateInventoryDto?.properties,
    ).toMatchObject({
      quantity: { type: 'integer', minimum: 0 },
    });
    expect(
      document.components?.schemas?.UpdateInventoryDto?.properties,
    ).toMatchObject({
      quantity: { type: 'integer', minimum: 0 },
    });
  });

  it('converts limit and skip to validated numbers on GET /inventory', async () => {
    const token = await tokenFor(UserRole.ADMIN);

    await request(app.getHttpServer())
      .get('/inventory?limit=17&skip=4')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(responseBody);

    expect(service.findAll).toHaveBeenCalledWith(
      { id: SELLER_ID, role: UserRole.ADMIN, sellerEnabled: false },
      expect.objectContaining({ limit: 17, skip: 4 }),
    );
  });

  it('converts limit and skip and executes GET /inventory/me for sellers', async () => {
    const token = await tokenFor(UserRole.SELLER);

    await request(app.getHttpServer())
      .get('/inventory/me?limit=17&skip=4')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(responseBody);

    expect(service.findMine).toHaveBeenCalledWith(
      { id: SELLER_ID, role: UserRole.SELLER, sellerEnabled: true },
      expect.objectContaining({ limit: 17, skip: 4 }),
    );
  });

  it('rejects invalid pagination with 400 without calling inventory service', async () => {
    const token = await tokenFor(UserRole.SELLER);

    await request(app.getHttpServer())
      .get('/inventory/me?limit=0')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(service.findMine).not.toHaveBeenCalled();
  });

  it('allows an admin on GET /inventory/me because the route permits sellers and admins', async () => {
    const token = await tokenFor(UserRole.ADMIN);

    await request(app.getHttpServer())
      .get('/inventory/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(responseBody);

    expect(service.findMine).toHaveBeenCalledOnce();
  });

  it('rejects a buyer from GET /inventory/me before the handler', async () => {
    const role = UserRole.BUYER;
    const token = await tokenFor(role);

    await request(app.getHttpServer())
      .get('/inventory/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(service.findMine).not.toHaveBeenCalled();
  });

  it('rejects missing, invalid, and expired JWTs before the handler', async () => {
    await request(app.getHttpServer()).get('/inventory/me').expect(401);
    await request(app.getHttpServer())
      .get('/inventory/me')
      .set('Authorization', 'Bearer invalid')
      .expect(401);

    const expired = await tokenFor(UserRole.SELLER, -1);
    await request(app.getHttpServer())
      .get('/inventory/me')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);

    expect(service.findMine).not.toHaveBeenCalled();
  });

  it('routes GET /inventory/:productId through its service', async () => {
    const token = await tokenFor(UserRole.SELLER);
    await request(app.getHttpServer())
      .get(`/inventory/${PRODUCT_ID}?businessId=65cb7f4a2d3b4c001f3e7a92`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(responseBody);
    expect(service.findByProductId).toHaveBeenCalledWith(
      PRODUCT_ID,
      '65cb7f4a2d3b4c001f3e7a92',
      { id: SELLER_ID, role: UserRole.SELLER, sellerEnabled: true },
    );
  });

  it('routes POST /inventory through its service', async () => {
    const token = await tokenFor(UserRole.SELLER);
    const payload = {
      productId: PRODUCT_ID,
      businessId: '65cb7f4a2d3b4c001f3e7a92',
      unitPrice: 12.5,
      quantity: 12,
    };
    await request(app.getHttpServer())
      .post('/inventory')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201)
      .expect(responseBody);
    expect(service.create).toHaveBeenCalledWith(payload, {
      id: SELLER_ID,
      role: UserRole.SELLER,
      sellerEnabled: true,
    });
  });

  it('routes PATCH /inventory/:productId through its service', async () => {
    const token = await tokenFor(UserRole.SELLER);
    const payload = {
      businessId: '65cb7f4a2d3b4c001f3e7a92',
      quantity: 8,
    };
    await request(app.getHttpServer())
      .patch(`/inventory/${PRODUCT_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(200)
      .expect(responseBody);
    expect(service.updateQuantity).toHaveBeenCalledWith(
      PRODUCT_ID,
      payload,
      { id: SELLER_ID, role: UserRole.SELLER, sellerEnabled: true },
    );
  });
});
