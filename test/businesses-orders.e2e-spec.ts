import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AccessTokenGuard } from '../src/auth/access-token.guard.js';
import { RolesGuard } from '../src/auth/roles.guard.js';
import { UserRole } from '../src/common/enums/auth.enum.js';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter.js';
import { BusinessesController } from '../src/businesses/businesses.controller.js';
import { BusinessesService } from '../src/businesses/businesses.service.js';
import { OrdersController } from '../src/orders/orders.controller.js';
import { OrdersService } from '../src/orders/orders.service.js';
import { SellersController } from '../src/sellers/sellers.controller.js';
import { SellersService } from '../src/sellers/sellers.service.js';

const TEST_SECRET = 'businesses-orders-e2e-secret-at-least-32-characters';
const USER_ID = '6ad241c4518543c0e9ca45c7';
const ADDRESS_ID = '65cb7f4a2d8b4c001f3e7a91';

describe('Businesses and orders HTTP API (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  const businessesService = {
    create: vi.fn().mockResolvedValue({
      id: '65cb7f4a2d3b4c001f3e7a92',
      businessName: 'Fresh Store',
      sellerEnabled: true,
      accessTokenRefreshRequired: true,
    }),
  };
  const ordersService = {
    create: vi.fn().mockResolvedValue({ id: '65cb7f4a2d3b4c001f3e7a97' }),
    getAvailableDeliveryWindows: vi.fn().mockResolvedValue([]),
    findMine: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue({ id: '65cb7f4a2d3b4c001f3e7a97' }),
  };
  const sellersService = {
    getGrossSales: vi.fn().mockResolvedValue({ currency: 'INR' }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [
        BusinessesController,
        OrdersController,
        SellersController,
      ],
      providers: [
        AccessTokenGuard,
        RolesGuard,
        { provide: BusinessesService, useValue: businessesService },
        { provide: OrdersService, useValue: ordersService },
        { provide: SellersService, useValue: sellersService },
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
    for (const method of Object.values(businessesService)) {
      method.mockClear();
    }
    for (const method of Object.values(ordersService)) {
      method.mockClear();
    }
    sellersService.getGrossSales.mockClear();
  });

  async function token(
    role: UserRole = UserRole.BUYER,
    sellerEnabled = false,
  ) {
    return jwtService.signAsync(
      { sub: USER_ID, type: 'access', role, sellerEnabled },
      { secret: TEST_SECRET },
    );
  }

  it('creates a business for the authenticated buyer and reports seller activation', async () => {
    const accessToken = await token();
    const payload = {
      businessName: 'Fresh Store',
      addressIds: [ADDRESS_ID],
    };

    await request(app.getHttpServer())
      .post('/businesses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payload)
      .expect(201)
      .expect({
        id: '65cb7f4a2d3b4c001f3e7a92',
        businessName: 'Fresh Store',
        sellerEnabled: true,
        accessTokenRefreshRequired: true,
      });

    expect(businessesService.create).toHaveBeenCalledWith(payload, {
      id: USER_ID,
      role: UserRole.BUYER,
      sellerEnabled: false,
    });
  });

  it('rejects invalid business address IDs before service execution', async () => {
    const accessToken = await token();

    await request(app.getHttpServer())
      .post('/businesses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ businessName: 'Fresh Store', addressIds: ['bad-id'] })
      .expect(400);

    expect(businessesService.create).not.toHaveBeenCalled();
  });

  it('routes checkout input to the authenticated order service', async () => {
    const accessToken = await token();
    const payload = {
      addressId: ADDRESS_ID,
      deliveryWindowStart: '2026-10-20T12:00:00.000Z',
      timeZone: 'Asia/Kolkata',
    };

    await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payload)
      .expect(201)
      .expect({ id: '65cb7f4a2d3b4c001f3e7a97' });

    expect(ordersService.create).toHaveBeenCalledWith(payload, {
      id: USER_ID,
      role: UserRole.BUYER,
      sellerEnabled: false,
    });
  });

  it('allows seller-capable buyer accounts to view their sales report', async () => {
    const accessToken = await token(UserRole.BUYER, true);

    await request(app.getHttpServer())
      .get('/seller/sales')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect({ currency: 'INR' });

    expect(sellersService.getGrossSales).toHaveBeenCalledWith(USER_ID);
  });

  it('rejects a buyer without seller capability from seller reporting', async () => {
    const accessToken = await token();

    await request(app.getHttpServer())
      .get('/seller/sales')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);

    expect(sellersService.getGrossSales).not.toHaveBeenCalled();
  });
});
