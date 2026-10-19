import { Types } from 'mongoose';
import { OrdersRepository } from '../orders/orders.repository.js';
import { SellersService } from './sellers.service.js';

describe('SellersService sales report', () => {
  it('reports item gross sales by owned business and links each checkout payment', async () => {
    const sellerId = '65cb7f4a2d3b4c001f3e7a95';
    const businessId = '65cb7f4a2d3b4c001f3e7a92';
    const productId = '65cb7f4a2d3b4c001f3e7a93';
    const ordersRepository = {
      findOrdersForSeller: vi.fn().mockResolvedValue([
        {
          _id: new Types.ObjectId('65cb7f4a2d3b4c001f3e7a97'),
          paymentId: new Types.ObjectId('65cb7f4a2d3b4c001f3e7a98'),
          sellerDeliveries: [
            {
              sellerId: new Types.ObjectId(sellerId),
              businessId: new Types.ObjectId(businessId),
              businessName: 'Fresh Store',
              grossAmount: 24,
              items: [
                {
                  productId: new Types.ObjectId(productId),
                  title: 'Apples',
                  quantity: 2,
                  lineTotal: 24,
                },
              ],
            },
          ],
        },
      ]),
    };
    const service = new SellersService(
      ordersRepository as unknown as OrdersRepository,
    );

    await expect(service.getGrossSales(sellerId)).resolves.toEqual({
      currency: 'INR',
      paymentMode: 'simulated',
      grossSales: 24,
      itemsSold: 2,
      businesses: [
        {
          businessId,
          businessName: 'Fresh Store',
          grossSales: 24,
          itemsSold: 2,
          orderCount: 1,
          products: [
            {
              productId,
              title: 'Apples',
              quantitySold: 2,
              grossSales: 24,
            },
          ],
          paymentReferences: [
            {
              orderId: '65cb7f4a2d3b4c001f3e7a97',
              paymentId: '65cb7f4a2d3b4c001f3e7a98',
            },
          ],
        },
      ],
    });
  });
});
