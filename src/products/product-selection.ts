import { BadRequestException } from '@nestjs/common';

export const PRODUCT_SELECTABLE_FIELDS = [
  '_id',
  'id',
  'sourceId',
  'title',
  'category',
  'description',
  'price',
  'discountPercentage',
  'rating',
  'tags',
  'brand',
  'sku',
  'weight',
  'dimensions',
  'warrantyInformation',
  'shippingInformation',
  'availabilityStatus',
  'reviews',
  'returnPolicy',
  'minimumOrderQuantity',
  'meta',
  'images',
  'thumbnail',
  'createdAt',
  'updatedAt',
  'inventory',
] as const;

export type ProductSelectableField =
  (typeof PRODUCT_SELECTABLE_FIELDS)[number];

const selectableFieldSet: ReadonlySet<string> = new Set(
  PRODUCT_SELECTABLE_FIELDS,
);
const derivedFields = new Set<ProductSelectableField>([
  'id',
  'inventory',
  'availabilityStatus',
]);

export function parseProductSelection(
  selection?: unknown,
): ProductSelectableField[] | undefined {
  if (selection === undefined) {
    return undefined;
  }
  if (typeof selection !== 'string' || selection.length > 500) {
    throw new BadRequestException(
      'select must be a comma-separated string of product fields',
    );
  }

  const fields = selection.split(',').map((field) => field.trim());
  if (
    fields.length === 0 ||
    fields.some(
      (field) =>
        field.length === 0 ||
        !isProductSelectableField(field) ||
        field.startsWith('$') ||
        field.includes('.'),
    )
  ) {
    throw new BadRequestException(
      `select must contain comma-separated product fields: ${PRODUCT_SELECTABLE_FIELDS.join(', ')}`,
    );
  }

  return [...new Set(fields.filter(isProductSelectableField))];
}

function isProductSelectableField(
  field: string,
): field is ProductSelectableField {
  return selectableFieldSet.has(field);
}

export function productProjection(
  fields: ProductSelectableField[],
): Record<string, 1> {
  const projection: Record<string, 1> = { _id: 1 };
  for (const field of fields) {
    if (!derivedFields.has(field)) {
      projection[field] = 1;
    }
  }
  return projection;
}

export function projectProductResponse(
  product: object,
  fields: ProductSelectableField[],
): Record<string, unknown> {
  return Object.fromEntries(
    fields.map((field) => [field, Reflect.get(product, field)]),
  );
}
