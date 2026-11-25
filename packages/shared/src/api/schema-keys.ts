import { z, type ZodTypeAny } from 'zod';

type ZodDef = {
  readonly typeName?: string;
  readonly shape?: (() => Record<string, ZodTypeAny>) | Record<string, ZodTypeAny>;
  readonly type?: ZodTypeAny;
  readonly innerType?: ZodTypeAny;
  readonly schema?: ZodTypeAny;
  readonly in?: ZodTypeAny;
  readonly out?: ZodTypeAny;
  readonly options?: readonly ZodTypeAny[] | Map<string, ZodTypeAny>;
  readonly left?: ZodTypeAny;
  readonly right?: ZodTypeAny;
  readonly valueType?: ZodTypeAny;
  readonly items?: readonly ZodTypeAny[];
  readonly getter?: () => ZodTypeAny;
};

function defOf(schema: ZodTypeAny): ZodDef {
  return schema._def as ZodDef;
}

/**
 * Recursively collect object property names from a Zod schema tree.
 * Used by the public-schema forbidden-key guard (T5.1).
 */
export function collectZodObjectKeys(
  schema: ZodTypeAny,
  out: Set<string> = new Set(),
): Set<string> {
  const def = defOf(schema);
  const typeName = def.typeName;

  switch (typeName) {
    case z.ZodFirstPartyTypeKind.ZodObject: {
      const shapeRaw = def.shape;
      const shape =
        typeof shapeRaw === 'function'
          ? shapeRaw()
          : (shapeRaw ?? ({} as Record<string, ZodTypeAny>));
      for (const [key, child] of Object.entries(shape)) {
        out.add(key);
        collectZodObjectKeys(child, out);
      }
      break;
    }
    case z.ZodFirstPartyTypeKind.ZodArray: {
      if (def.type !== undefined) {
        collectZodObjectKeys(def.type, out);
      }
      break;
    }
    case z.ZodFirstPartyTypeKind.ZodOptional:
    case z.ZodFirstPartyTypeKind.ZodNullable:
    case z.ZodFirstPartyTypeKind.ZodDefault:
    case z.ZodFirstPartyTypeKind.ZodCatch:
    case z.ZodFirstPartyTypeKind.ZodReadonly: {
      if (def.innerType !== undefined) {
        collectZodObjectKeys(def.innerType, out);
      }
      break;
    }
    case z.ZodFirstPartyTypeKind.ZodEffects: {
      if (def.schema !== undefined) {
        collectZodObjectKeys(def.schema, out);
      }
      break;
    }
    case z.ZodFirstPartyTypeKind.ZodPipeline: {
      if (def.in !== undefined) {
        collectZodObjectKeys(def.in, out);
      }
      if (def.out !== undefined) {
        collectZodObjectKeys(def.out, out);
      }
      break;
    }
    case z.ZodFirstPartyTypeKind.ZodUnion:
    case z.ZodFirstPartyTypeKind.ZodDiscriminatedUnion: {
      const options = def.options;
      if (options instanceof Map) {
        for (const option of options.values()) {
          collectZodObjectKeys(option, out);
        }
      } else if (options !== undefined) {
        for (const option of options) {
          collectZodObjectKeys(option, out);
        }
      }
      break;
    }
    case z.ZodFirstPartyTypeKind.ZodIntersection: {
      if (def.left !== undefined) {
        collectZodObjectKeys(def.left, out);
      }
      if (def.right !== undefined) {
        collectZodObjectKeys(def.right, out);
      }
      break;
    }
    case z.ZodFirstPartyTypeKind.ZodRecord: {
      if (def.valueType !== undefined) {
        collectZodObjectKeys(def.valueType, out);
      }
      break;
    }
    case z.ZodFirstPartyTypeKind.ZodTuple: {
      if (def.items !== undefined) {
        for (const item of def.items) {
          collectZodObjectKeys(item, out);
        }
      }
      break;
    }
    case z.ZodFirstPartyTypeKind.ZodLazy: {
      if (def.getter !== undefined) {
        collectZodObjectKeys(def.getter(), out);
      }
      break;
    }
    case z.ZodFirstPartyTypeKind.ZodBranded: {
      if (def.type !== undefined) {
        collectZodObjectKeys(def.type, out);
      }
      break;
    }
    default:
      break;
  }

  return out;
}
