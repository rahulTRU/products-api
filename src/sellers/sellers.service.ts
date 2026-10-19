import { Injectable } from '@nestjs/common';
import { OrdersRepository } from '../orders/orders.repository.js';

export interface ProductSalesSummary {
  productId: string;
  title: string;
  quantitySold: number;
  grossSales: number;
}

export interface BusinessSalesSummary {
  businessId: string;
  businessName: string;
  grossSales: number;
  itemsSold: number;
  orderCount: number;
  products: Map<string, ProductSalesSummary>;
  paymentReferences: {
    orderId: string;
    paymentId: string | null;
  }[];
}

@Injectable()
export class SellersService {
  constructor(private readonly ordersRepository: OrdersRepository) {}

  async getGrossSales(sellerId: string) {
    const orders = await this.ordersRepository.findOrdersForSeller(sellerId);
    const businesses = new Map<string, BusinessSalesSummary>();
    for (const order of orders) {
      for (const delivery of order.sellerDeliveries) {
        if (delivery.sellerId.toString() !== sellerId) {
          continue;
        }
        const businessId = delivery.businessId.toString();
        const summary = businesses.get(businessId) ?? {
          businessId,
          businessName: delivery.businessName,
          grossSales: 0,
          itemsSold: 0,
          orderCount: 0,
          products: new Map<string, ProductSalesSummary>(),
          paymentReferences: [],
        };
        summary.grossSales = roundMoney(
          summary.grossSales + delivery.grossAmount,
        );
        summary.itemsSold += delivery.items.reduce(
          (total, item) => total + item.quantity,
          0,
        );
        summary.orderCount += 1;
        summary.paymentReferences.push({
          orderId: order._id.toString(),
          paymentId: order.paymentId?.toString() ?? null,
        });
        for (const item of delivery.items) {
          const productId = item.productId.toString();
          const product = summary.products.get(productId) ?? {
            productId,
            title: item.title,
            quantitySold: 0,
            grossSales: 0,
          };
          product.quantitySold += item.quantity;
          product.grossSales = roundMoney(
            product.grossSales + item.lineTotal,
          );
          summary.products.set(productId, product);
        }
        businesses.set(businessId, summary);
      }
    }
    const summaries = [...businesses.values()].map((business) => ({
      businessId: business.businessId,
      businessName: business.businessName,
      grossSales: business.grossSales,
      itemsSold: business.itemsSold,
      orderCount: business.orderCount,
      products: [...business.products.values()],
      paymentReferences: business.paymentReferences,
    }));
    return {
      currency: 'INR',
      paymentMode: 'simulated',
      grossSales: roundMoney(
        summaries.reduce((total, business) => total + business.grossSales, 0),
      ),
      itemsSold: summaries.reduce(
        (total, business) => total + business.itemsSold,
        0,
      ),
      businesses: summaries,
    };
  }
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
