import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AccessTokenGuard } from '../src/auth/access-token.guard.js';
import { UserRole } from '../src/common/enums/auth.enum.js';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter.js';
import { AddressesController } from '../src/addresses/addresses.controller.js';
import { AddressesService } from '../src/addresses/addresses.service.js';

const TEST_SECRET = 'addresses-e2e-access-secret-at-least-32-characters';
const USER_ID = '6ad241c4518543c0e9ca45c7';
const ADDRESS_ID = '65cb7f4a2d8b4c001f3e7a91';
const addressResponse = {
  _id: ADDRESS_ID,
  userId: USER_ID,
  googlePlaceId: 'ChIJ2eLE1mOWmwARsY5ptr4Jw80',
  formattedAddress:
    '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA',
  components: {
    streetNumber: '1600',
    route: 'Amphitheatre Pkwy',
    city: 'Mountain View',
    state: 'CA',
    postalCode: '94043',
    country: 'US',
  },
  location: {
    type: 'Point',
    coordinates: [-122.0842499, 37.4220656],
  },
  metadata: { rawUserInput: 'googlehq', isVerified: false },
  createdAt: '2026-10-19T11:45:00.000Z',
  updatedAt: '2026-10-19T11:45:00.000Z',
};

describe('AddressesController HTTP API (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let addressesService: {
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  beforeAll(async () => {
    addressesService = {
      findAll: vi.fn().mockResolvedValue([addressResponse]),
      findOne: vi.fn().mockResolvedValue(addressResponse),
      create: vi.fn().mockResolvedValue(addressResponse),
      update: vi.fn().mockResolvedValue(addressResponse),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [AddressesController],
      providers: [
        AccessTokenGuard,
        { provide: AddressesService, useValue: addressesService },
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
    for (const method of Object.values(addressesService)) {
      method.mockClear();
    }
    addressesService.findAll.mockResolvedValue([addressResponse]);
    addressesService.findOne.mockResolvedValue(addressResponse);
    addressesService.create.mockResolvedValue(addressResponse);
    addressesService.update.mockResolvedValue(addressResponse);
    addressesService.remove.mockResolvedValue(undefined);
  });

  async function accessToken(): Promise<string> {
    return jwtService.signAsync(
      { sub: USER_ID, type: 'access', role: UserRole.BUYER },
      { secret: TEST_SECRET },
    );
  }

  it('requires a valid access token before listing addresses', async () => {
    await request(app.getHttpServer()).get('/addresses').expect(401);
    const token = await accessToken();
    await request(app.getHttpServer())
      .get('/addresses')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect([addressResponse]);

    expect(addressesService.findAll).toHaveBeenCalledWith({
      id: USER_ID,
      role: UserRole.BUYER,
    });
  });

  it('supports create, single fetch, partial update, and delete', async () => {
    const token = await accessToken();
    const createPayload = {
      googlePlaceId: 'ChIJ2eLE1mOWmwARsY5ptr4Jw80',
      formattedAddress:
        '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA',
      components: addressResponse.components,
      location: addressResponse.location,
      metadata: { rawUserInput: 'googlehq' },
    };

    await request(app.getHttpServer())
      .post('/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(createPayload)
      .expect(201)
      .expect(addressResponse);
    expect(addressesService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        formattedAddress: createPayload.formattedAddress,
      }),
      { id: USER_ID, role: UserRole.BUYER },
    );

    await request(app.getHttpServer())
      .get(`/addresses/${ADDRESS_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(addressResponse);
    expect(addressesService.findOne).toHaveBeenCalledWith(ADDRESS_ID, {
      id: USER_ID,
      role: UserRole.BUYER,
    });

    await request(app.getHttpServer())
      .patch(`/addresses/${ADDRESS_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ formattedAddress: 'Updated address' })
      .expect(200)
      .expect(addressResponse);
    expect(addressesService.update).toHaveBeenCalledWith(
      ADDRESS_ID,
      { formattedAddress: 'Updated address' },
      { id: USER_ID, role: UserRole.BUYER },
    );

    await request(app.getHttpServer())
      .delete(`/addresses/${ADDRESS_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
    expect(addressesService.remove).toHaveBeenCalledWith(ADDRESS_ID, {
      id: USER_ID,
      role: UserRole.BUYER,
    });
  });

  it('rejects client-controlled ownership and verification fields', async () => {
    const token = await accessToken();

    await request(app.getHttpServer())
      .post('/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        formattedAddress: 'Mountain View, CA',
        userId: '6ad241c4518543c0e9ca45c8',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        formattedAddress: 'Mountain View, CA',
        metadata: { isVerified: true },
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        formattedAddress: 'Mountain View, CA',
        location: { type: 'Point', coordinates: [-200, 37] },
      })
      .expect(400);

    expect(addressesService.create).not.toHaveBeenCalled();
  });
});
