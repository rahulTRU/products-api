import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AddressesService } from '../src/addresses/addresses.service.js';
import { AccessTokenGuard } from '../src/auth/access-token.guard.js';
import { UserRole } from '../src/common/enums/auth.enum.js';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter.js';
import { UsersController } from '../src/users/users.controller.js';
import { UsersService } from '../src/users/users.service.js';

const TEST_SECRET = 'users-latest-address-secret-at-least-32-characters';
const USER_ID = '6ad241c4518543c0e9ca45c7';
const ADDRESS_ID = '65cb7f4a2d8b4c001f3e7a91';

describe('PATCH /users/latest-address (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let selectLatestAddress: ReturnType<typeof vi.fn>;
  let findOne: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    selectLatestAddress = vi.fn().mockResolvedValue({
      latestSelectedAddressId: ADDRESS_ID,
    });
    findOne = vi.fn().mockResolvedValue({ _id: ADDRESS_ID });
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [UsersController],
      providers: [
        AccessTokenGuard,
        { provide: AddressesService, useValue: { findOne } },
        { provide: UsersService, useValue: { selectLatestAddress } },
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
    selectLatestAddress.mockClear();
    selectLatestAddress.mockResolvedValue({
      latestSelectedAddressId: ADDRESS_ID,
    });
  });

  async function token(): Promise<string> {
    return jwtService.signAsync(
      { sub: USER_ID, type: 'access', role: UserRole.BUYER },
      { secret: TEST_SECRET },
    );
  }

  it('requires authentication and updates the current user selected address', async () => {
    await request(app.getHttpServer())
      .patch('/users/latest-address')
      .send({ addressId: ADDRESS_ID })
      .expect(401);

    const accessToken = await token();
    await request(app.getHttpServer())
      .patch('/users/latest-address')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ addressId: ADDRESS_ID })
      .expect(200)
      .expect({ latestSelectedAddressId: ADDRESS_ID });

    expect(selectLatestAddress).toHaveBeenCalledWith(
      { addressId: ADDRESS_ID },
      { id: USER_ID, role: UserRole.BUYER },
    );
  });

  it('rejects malformed address IDs before updating the user', async () => {
    const accessToken = await token();
    await request(app.getHttpServer())
      .patch('/users/latest-address')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ addressId: 'not-an-object-id' })
      .expect(400);

    expect(selectLatestAddress).not.toHaveBeenCalled();
  });
});
