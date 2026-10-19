import { BadRequestException } from '@nestjs/common';
import {
  parseProductSelection,
  productProjection,
  projectProductResponse,
} from './product-selection.js';

describe('product field selection', () => {
  it('parses comma-separated fields, trims whitespace, and removes duplicates', () => {
    expect(parseProductSelection(' title, price, title ')).toEqual([
      'title',
      'price',
    ]);
  });

  it('rejects Mongo operators, nested paths, internal fields, and empty fields', () => {
    for (const selection of [
      '$where',
      'title.$where',
      'createdBy',
      'title,,price',
      '',
      ['title', 'price'],
      'x'.repeat(501),
    ]) {
      expect(() => parseProductSelection(selection)).toThrow(
        BadRequestException,
      );
    }
  });

  it('builds a trusted inclusion projection with the internal join key', () => {
    const fields = parseProductSelection('title,price');
    expect(fields).toBeDefined();
    expect(productProjection(fields!)).toEqual({
      _id: 1,
      title: 1,
      price: 1,
    });
  });

  it('returns exactly the requested response fields', () => {
    expect(
      projectProductResponse(
        {
          _id: 'object-id',
          id: 'string-id',
          title: 'Mascara',
          price: 9,
          createdBy: 'internal-owner-id',
        },
        ['title', 'price'],
      ),
    ).toEqual({ title: 'Mascara', price: 9 });
  });
});
