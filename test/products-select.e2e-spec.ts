import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AccessTokenGuard } from '../src/auth/access-token.guard.js';
import { AuthPrincipal } from '../src/auth/auth.types.js';
import { UserRole } from '../src/common/enums/auth.enum.js';
import { ProductsController } from '../src/products/products.controller.js';
import { ProductsService } from '../src/products/products.service.js';

const USER: AuthPrincipal = {
  id: '6ad241c4518543c0e9ca45c7',
  role: UserRole.SELLER,
};
const PRODUCT_ID = '6ad2522633589a8263596d5d';
const selectedProducts = [{ title: 'Mascara', price: 9.99 }];

describe('Product selection routes (e2e)', () => {
  let app: INestApplication<App>;
  let productsService: {
    findAll: ReturnType<typeof vi.fn>;
    findMine: ReturnType<typeof vi.fn>;
    findByCategory: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
  };

  beforeAll(async () => {
    productsService = {
      findAll: vi.fn().mockResolvedValue(selectedProducts),
      findMine: vi.fn().mockResolvedValue(selectedProducts),
      findByCategory: vi.fn().mockResolvedValue(selectedProducts),
      findOne: vi.fn().mockResolvedValue(selectedProducts[0]),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: productsService }],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => { user?: AuthPrincipal };
          };
        }) => {
          context.switchToHttp().getRequest().user = USER;
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
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
    for (const method of Object.values(productsService)) {
      method.mockClear();
      method.mockResolvedValue(selectedProducts);
    }
    productsService.findOne.mockResolvedValue(selectedProducts[0]);
  });

  it('documents select on every product retrieval route', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    for (const [path, method] of [
      ['/products', 'get'],
      ['/products/me', 'get'],
      ['/products/category/{category}', 'get'],
      ['/products/{id}', 'get'],
    ] as const) {
      expect(
        document.paths[path]?.[method]?.parameters?.find(
          (parameter) => parameter.name === 'select',
        ),
      ).toMatchObject({
        in: 'query',
        schema: { example: 'title,price' },
      });
    }
  });

  it('passes select through the public product list route', async () => {
    await request(app.getHttpServer())
      .get('/products?select=title,price')
      .expect(200)
      .expect(selectedProducts);
    expect(productsService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ select: 'title,price' }),
    );
  });

  it('passes select through the authenticated seller product list route', async () => {
    await request(app.getHttpServer())
      .get('/products/me?select=title,price')
      .expect(200)
      .expect(selectedProducts);
    expect(productsService.findMine).toHaveBeenCalledWith(
      USER.id,
      expect.objectContaining({ select: 'title,price' }),
    );
  });

  it('passes select through category and single-product fetch routes', async () => {
    await request(app.getHttpServer())
      .get('/products/category/beauty?select=title,price')
      .expect(200)
      .expect(selectedProducts);
    expect(productsService.findByCategory).toHaveBeenCalledWith(
      'beauty',
      expect.objectContaining({ select: 'title,price' }),
    );

    await request(app.getHttpServer())
      .get(`/products/${PRODUCT_ID}?select=title,price`)
      .expect(200)
      .expect(selectedProducts[0]);
    expect(productsService.findOne).toHaveBeenCalledWith(
      PRODUCT_ID,
      'title,price',
    );
  });
});
