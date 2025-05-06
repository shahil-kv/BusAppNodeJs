
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model bus_owners
 * 
 */
export type bus_owners = $Result.DefaultSelection<Prisma.$bus_ownersPayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Bus_owners
 * const bus_owners = await prisma.bus_owners.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Bus_owners
   * const bus_owners = await prisma.bus_owners.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Add a middleware
   * @deprecated since 4.16.0. For new code, prefer client extensions instead.
   * @see https://pris.ly/d/extensions
   */
  $use(cb: Prisma.Middleware): void

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.bus_owners`: Exposes CRUD operations for the **bus_owners** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Bus_owners
    * const bus_owners = await prisma.bus_owners.findMany()
    * ```
    */
  get bus_owners(): Prisma.bus_ownersDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 6.6.0
   * Query Engine version: f676762280b54cd07c770017ed3711ddde35f37a
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    bus_owners: 'bus_owners'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "bus_owners"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      bus_owners: {
        payload: Prisma.$bus_ownersPayload<ExtArgs>
        fields: Prisma.bus_ownersFieldRefs
        operations: {
          findUnique: {
            args: Prisma.bus_ownersFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$bus_ownersPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.bus_ownersFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$bus_ownersPayload>
          }
          findFirst: {
            args: Prisma.bus_ownersFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$bus_ownersPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.bus_ownersFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$bus_ownersPayload>
          }
          findMany: {
            args: Prisma.bus_ownersFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$bus_ownersPayload>[]
          }
          create: {
            args: Prisma.bus_ownersCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$bus_ownersPayload>
          }
          createMany: {
            args: Prisma.bus_ownersCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.bus_ownersCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$bus_ownersPayload>[]
          }
          delete: {
            args: Prisma.bus_ownersDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$bus_ownersPayload>
          }
          update: {
            args: Prisma.bus_ownersUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$bus_ownersPayload>
          }
          deleteMany: {
            args: Prisma.bus_ownersDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.bus_ownersUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.bus_ownersUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$bus_ownersPayload>[]
          }
          upsert: {
            args: Prisma.bus_ownersUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$bus_ownersPayload>
          }
          aggregate: {
            args: Prisma.Bus_ownersAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateBus_owners>
          }
          groupBy: {
            args: Prisma.bus_ownersGroupByArgs<ExtArgs>
            result: $Utils.Optional<Bus_ownersGroupByOutputType>[]
          }
          count: {
            args: Prisma.bus_ownersCountArgs<ExtArgs>
            result: $Utils.Optional<Bus_ownersCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Defaults to stdout
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events
     * log: [
     *   { emit: 'stdout', level: 'query' },
     *   { emit: 'stdout', level: 'info' },
     *   { emit: 'stdout', level: 'warn' }
     *   { emit: 'stdout', level: 'error' }
     * ]
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
  }
  export type GlobalOmitConfig = {
    bus_owners?: bus_ownersOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
  export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
    GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
    : never

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  /**
   * These options are being passed into the middleware as "params"
   */
  export type MiddlewareParams = {
    model?: ModelName
    action: PrismaAction
    args: any
    dataPath: string[]
    runInTransaction: boolean
  }

  /**
   * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
   */
  export type Middleware<T = any> = (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => $Utils.JsPromise<T>,
  ) => $Utils.JsPromise<T>

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */



  /**
   * Models
   */

  /**
   * Model bus_owners
   */

  export type AggregateBus_owners = {
    _count: Bus_ownersCountAggregateOutputType | null
    _avg: Bus_ownersAvgAggregateOutputType | null
    _sum: Bus_ownersSumAggregateOutputType | null
    _min: Bus_ownersMinAggregateOutputType | null
    _max: Bus_ownersMaxAggregateOutputType | null
  }

  export type Bus_ownersAvgAggregateOutputType = {
    bus_owner_id: number | null
  }

  export type Bus_ownersSumAggregateOutputType = {
    bus_owner_id: number | null
  }

  export type Bus_ownersMinAggregateOutputType = {
    bus_owner_id: number | null
    full_name: string | null
    phone_number: string | null
    password_hash: string | null
    company_name: string | null
    is_email_verified: boolean | null
    email_verification_token: string | null
    email_verification_expiry: Date | null
    created_at: Date | null
    updated_at: Date | null
  }

  export type Bus_ownersMaxAggregateOutputType = {
    bus_owner_id: number | null
    full_name: string | null
    phone_number: string | null
    password_hash: string | null
    company_name: string | null
    is_email_verified: boolean | null
    email_verification_token: string | null
    email_verification_expiry: Date | null
    created_at: Date | null
    updated_at: Date | null
  }

  export type Bus_ownersCountAggregateOutputType = {
    bus_owner_id: number
    full_name: number
    phone_number: number
    password_hash: number
    company_name: number
    is_email_verified: number
    email_verification_token: number
    email_verification_expiry: number
    created_at: number
    updated_at: number
    _all: number
  }


  export type Bus_ownersAvgAggregateInputType = {
    bus_owner_id?: true
  }

  export type Bus_ownersSumAggregateInputType = {
    bus_owner_id?: true
  }

  export type Bus_ownersMinAggregateInputType = {
    bus_owner_id?: true
    full_name?: true
    phone_number?: true
    password_hash?: true
    company_name?: true
    is_email_verified?: true
    email_verification_token?: true
    email_verification_expiry?: true
    created_at?: true
    updated_at?: true
  }

  export type Bus_ownersMaxAggregateInputType = {
    bus_owner_id?: true
    full_name?: true
    phone_number?: true
    password_hash?: true
    company_name?: true
    is_email_verified?: true
    email_verification_token?: true
    email_verification_expiry?: true
    created_at?: true
    updated_at?: true
  }

  export type Bus_ownersCountAggregateInputType = {
    bus_owner_id?: true
    full_name?: true
    phone_number?: true
    password_hash?: true
    company_name?: true
    is_email_verified?: true
    email_verification_token?: true
    email_verification_expiry?: true
    created_at?: true
    updated_at?: true
    _all?: true
  }

  export type Bus_ownersAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which bus_owners to aggregate.
     */
    where?: bus_ownersWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of bus_owners to fetch.
     */
    orderBy?: bus_ownersOrderByWithRelationInput | bus_ownersOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: bus_ownersWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` bus_owners from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` bus_owners.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned bus_owners
    **/
    _count?: true | Bus_ownersCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: Bus_ownersAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: Bus_ownersSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: Bus_ownersMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: Bus_ownersMaxAggregateInputType
  }

  export type GetBus_ownersAggregateType<T extends Bus_ownersAggregateArgs> = {
        [P in keyof T & keyof AggregateBus_owners]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateBus_owners[P]>
      : GetScalarType<T[P], AggregateBus_owners[P]>
  }




  export type bus_ownersGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: bus_ownersWhereInput
    orderBy?: bus_ownersOrderByWithAggregationInput | bus_ownersOrderByWithAggregationInput[]
    by: Bus_ownersScalarFieldEnum[] | Bus_ownersScalarFieldEnum
    having?: bus_ownersScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: Bus_ownersCountAggregateInputType | true
    _avg?: Bus_ownersAvgAggregateInputType
    _sum?: Bus_ownersSumAggregateInputType
    _min?: Bus_ownersMinAggregateInputType
    _max?: Bus_ownersMaxAggregateInputType
  }

  export type Bus_ownersGroupByOutputType = {
    bus_owner_id: number
    full_name: string
    phone_number: string
    password_hash: string
    company_name: string | null
    is_email_verified: boolean
    email_verification_token: string | null
    email_verification_expiry: Date | null
    created_at: Date
    updated_at: Date
    _count: Bus_ownersCountAggregateOutputType | null
    _avg: Bus_ownersAvgAggregateOutputType | null
    _sum: Bus_ownersSumAggregateOutputType | null
    _min: Bus_ownersMinAggregateOutputType | null
    _max: Bus_ownersMaxAggregateOutputType | null
  }

  type GetBus_ownersGroupByPayload<T extends bus_ownersGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<Bus_ownersGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof Bus_ownersGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], Bus_ownersGroupByOutputType[P]>
            : GetScalarType<T[P], Bus_ownersGroupByOutputType[P]>
        }
      >
    >


  export type bus_ownersSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    bus_owner_id?: boolean
    full_name?: boolean
    phone_number?: boolean
    password_hash?: boolean
    company_name?: boolean
    is_email_verified?: boolean
    email_verification_token?: boolean
    email_verification_expiry?: boolean
    created_at?: boolean
    updated_at?: boolean
  }, ExtArgs["result"]["bus_owners"]>

  export type bus_ownersSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    bus_owner_id?: boolean
    full_name?: boolean
    phone_number?: boolean
    password_hash?: boolean
    company_name?: boolean
    is_email_verified?: boolean
    email_verification_token?: boolean
    email_verification_expiry?: boolean
    created_at?: boolean
    updated_at?: boolean
  }, ExtArgs["result"]["bus_owners"]>

  export type bus_ownersSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    bus_owner_id?: boolean
    full_name?: boolean
    phone_number?: boolean
    password_hash?: boolean
    company_name?: boolean
    is_email_verified?: boolean
    email_verification_token?: boolean
    email_verification_expiry?: boolean
    created_at?: boolean
    updated_at?: boolean
  }, ExtArgs["result"]["bus_owners"]>

  export type bus_ownersSelectScalar = {
    bus_owner_id?: boolean
    full_name?: boolean
    phone_number?: boolean
    password_hash?: boolean
    company_name?: boolean
    is_email_verified?: boolean
    email_verification_token?: boolean
    email_verification_expiry?: boolean
    created_at?: boolean
    updated_at?: boolean
  }

  export type bus_ownersOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"bus_owner_id" | "full_name" | "phone_number" | "password_hash" | "company_name" | "is_email_verified" | "email_verification_token" | "email_verification_expiry" | "created_at" | "updated_at", ExtArgs["result"]["bus_owners"]>

  export type $bus_ownersPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "bus_owners"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      bus_owner_id: number
      full_name: string
      phone_number: string
      password_hash: string
      company_name: string | null
      is_email_verified: boolean
      email_verification_token: string | null
      email_verification_expiry: Date | null
      created_at: Date
      updated_at: Date
    }, ExtArgs["result"]["bus_owners"]>
    composites: {}
  }

  type bus_ownersGetPayload<S extends boolean | null | undefined | bus_ownersDefaultArgs> = $Result.GetResult<Prisma.$bus_ownersPayload, S>

  type bus_ownersCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<bus_ownersFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: Bus_ownersCountAggregateInputType | true
    }

  export interface bus_ownersDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['bus_owners'], meta: { name: 'bus_owners' } }
    /**
     * Find zero or one Bus_owners that matches the filter.
     * @param {bus_ownersFindUniqueArgs} args - Arguments to find a Bus_owners
     * @example
     * // Get one Bus_owners
     * const bus_owners = await prisma.bus_owners.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends bus_ownersFindUniqueArgs>(args: SelectSubset<T, bus_ownersFindUniqueArgs<ExtArgs>>): Prisma__bus_ownersClient<$Result.GetResult<Prisma.$bus_ownersPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Bus_owners that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {bus_ownersFindUniqueOrThrowArgs} args - Arguments to find a Bus_owners
     * @example
     * // Get one Bus_owners
     * const bus_owners = await prisma.bus_owners.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends bus_ownersFindUniqueOrThrowArgs>(args: SelectSubset<T, bus_ownersFindUniqueOrThrowArgs<ExtArgs>>): Prisma__bus_ownersClient<$Result.GetResult<Prisma.$bus_ownersPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Bus_owners that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {bus_ownersFindFirstArgs} args - Arguments to find a Bus_owners
     * @example
     * // Get one Bus_owners
     * const bus_owners = await prisma.bus_owners.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends bus_ownersFindFirstArgs>(args?: SelectSubset<T, bus_ownersFindFirstArgs<ExtArgs>>): Prisma__bus_ownersClient<$Result.GetResult<Prisma.$bus_ownersPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Bus_owners that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {bus_ownersFindFirstOrThrowArgs} args - Arguments to find a Bus_owners
     * @example
     * // Get one Bus_owners
     * const bus_owners = await prisma.bus_owners.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends bus_ownersFindFirstOrThrowArgs>(args?: SelectSubset<T, bus_ownersFindFirstOrThrowArgs<ExtArgs>>): Prisma__bus_ownersClient<$Result.GetResult<Prisma.$bus_ownersPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Bus_owners that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {bus_ownersFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Bus_owners
     * const bus_owners = await prisma.bus_owners.findMany()
     * 
     * // Get first 10 Bus_owners
     * const bus_owners = await prisma.bus_owners.findMany({ take: 10 })
     * 
     * // Only select the `bus_owner_id`
     * const bus_ownersWithBus_owner_idOnly = await prisma.bus_owners.findMany({ select: { bus_owner_id: true } })
     * 
     */
    findMany<T extends bus_ownersFindManyArgs>(args?: SelectSubset<T, bus_ownersFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$bus_ownersPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Bus_owners.
     * @param {bus_ownersCreateArgs} args - Arguments to create a Bus_owners.
     * @example
     * // Create one Bus_owners
     * const Bus_owners = await prisma.bus_owners.create({
     *   data: {
     *     // ... data to create a Bus_owners
     *   }
     * })
     * 
     */
    create<T extends bus_ownersCreateArgs>(args: SelectSubset<T, bus_ownersCreateArgs<ExtArgs>>): Prisma__bus_ownersClient<$Result.GetResult<Prisma.$bus_ownersPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Bus_owners.
     * @param {bus_ownersCreateManyArgs} args - Arguments to create many Bus_owners.
     * @example
     * // Create many Bus_owners
     * const bus_owners = await prisma.bus_owners.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends bus_ownersCreateManyArgs>(args?: SelectSubset<T, bus_ownersCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Bus_owners and returns the data saved in the database.
     * @param {bus_ownersCreateManyAndReturnArgs} args - Arguments to create many Bus_owners.
     * @example
     * // Create many Bus_owners
     * const bus_owners = await prisma.bus_owners.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Bus_owners and only return the `bus_owner_id`
     * const bus_ownersWithBus_owner_idOnly = await prisma.bus_owners.createManyAndReturn({
     *   select: { bus_owner_id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends bus_ownersCreateManyAndReturnArgs>(args?: SelectSubset<T, bus_ownersCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$bus_ownersPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Bus_owners.
     * @param {bus_ownersDeleteArgs} args - Arguments to delete one Bus_owners.
     * @example
     * // Delete one Bus_owners
     * const Bus_owners = await prisma.bus_owners.delete({
     *   where: {
     *     // ... filter to delete one Bus_owners
     *   }
     * })
     * 
     */
    delete<T extends bus_ownersDeleteArgs>(args: SelectSubset<T, bus_ownersDeleteArgs<ExtArgs>>): Prisma__bus_ownersClient<$Result.GetResult<Prisma.$bus_ownersPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Bus_owners.
     * @param {bus_ownersUpdateArgs} args - Arguments to update one Bus_owners.
     * @example
     * // Update one Bus_owners
     * const bus_owners = await prisma.bus_owners.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends bus_ownersUpdateArgs>(args: SelectSubset<T, bus_ownersUpdateArgs<ExtArgs>>): Prisma__bus_ownersClient<$Result.GetResult<Prisma.$bus_ownersPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Bus_owners.
     * @param {bus_ownersDeleteManyArgs} args - Arguments to filter Bus_owners to delete.
     * @example
     * // Delete a few Bus_owners
     * const { count } = await prisma.bus_owners.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends bus_ownersDeleteManyArgs>(args?: SelectSubset<T, bus_ownersDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Bus_owners.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {bus_ownersUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Bus_owners
     * const bus_owners = await prisma.bus_owners.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends bus_ownersUpdateManyArgs>(args: SelectSubset<T, bus_ownersUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Bus_owners and returns the data updated in the database.
     * @param {bus_ownersUpdateManyAndReturnArgs} args - Arguments to update many Bus_owners.
     * @example
     * // Update many Bus_owners
     * const bus_owners = await prisma.bus_owners.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Bus_owners and only return the `bus_owner_id`
     * const bus_ownersWithBus_owner_idOnly = await prisma.bus_owners.updateManyAndReturn({
     *   select: { bus_owner_id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends bus_ownersUpdateManyAndReturnArgs>(args: SelectSubset<T, bus_ownersUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$bus_ownersPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Bus_owners.
     * @param {bus_ownersUpsertArgs} args - Arguments to update or create a Bus_owners.
     * @example
     * // Update or create a Bus_owners
     * const bus_owners = await prisma.bus_owners.upsert({
     *   create: {
     *     // ... data to create a Bus_owners
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Bus_owners we want to update
     *   }
     * })
     */
    upsert<T extends bus_ownersUpsertArgs>(args: SelectSubset<T, bus_ownersUpsertArgs<ExtArgs>>): Prisma__bus_ownersClient<$Result.GetResult<Prisma.$bus_ownersPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Bus_owners.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {bus_ownersCountArgs} args - Arguments to filter Bus_owners to count.
     * @example
     * // Count the number of Bus_owners
     * const count = await prisma.bus_owners.count({
     *   where: {
     *     // ... the filter for the Bus_owners we want to count
     *   }
     * })
    **/
    count<T extends bus_ownersCountArgs>(
      args?: Subset<T, bus_ownersCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], Bus_ownersCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Bus_owners.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {Bus_ownersAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends Bus_ownersAggregateArgs>(args: Subset<T, Bus_ownersAggregateArgs>): Prisma.PrismaPromise<GetBus_ownersAggregateType<T>>

    /**
     * Group by Bus_owners.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {bus_ownersGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends bus_ownersGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: bus_ownersGroupByArgs['orderBy'] }
        : { orderBy?: bus_ownersGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, bus_ownersGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetBus_ownersGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the bus_owners model
   */
  readonly fields: bus_ownersFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for bus_owners.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__bus_ownersClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the bus_owners model
   */
  interface bus_ownersFieldRefs {
    readonly bus_owner_id: FieldRef<"bus_owners", 'Int'>
    readonly full_name: FieldRef<"bus_owners", 'String'>
    readonly phone_number: FieldRef<"bus_owners", 'String'>
    readonly password_hash: FieldRef<"bus_owners", 'String'>
    readonly company_name: FieldRef<"bus_owners", 'String'>
    readonly is_email_verified: FieldRef<"bus_owners", 'Boolean'>
    readonly email_verification_token: FieldRef<"bus_owners", 'String'>
    readonly email_verification_expiry: FieldRef<"bus_owners", 'DateTime'>
    readonly created_at: FieldRef<"bus_owners", 'DateTime'>
    readonly updated_at: FieldRef<"bus_owners", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * bus_owners findUnique
   */
  export type bus_ownersFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the bus_owners
     */
    select?: bus_ownersSelect<ExtArgs> | null
    /**
     * Omit specific fields from the bus_owners
     */
    omit?: bus_ownersOmit<ExtArgs> | null
    /**
     * Filter, which bus_owners to fetch.
     */
    where: bus_ownersWhereUniqueInput
  }

  /**
   * bus_owners findUniqueOrThrow
   */
  export type bus_ownersFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the bus_owners
     */
    select?: bus_ownersSelect<ExtArgs> | null
    /**
     * Omit specific fields from the bus_owners
     */
    omit?: bus_ownersOmit<ExtArgs> | null
    /**
     * Filter, which bus_owners to fetch.
     */
    where: bus_ownersWhereUniqueInput
  }

  /**
   * bus_owners findFirst
   */
  export type bus_ownersFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the bus_owners
     */
    select?: bus_ownersSelect<ExtArgs> | null
    /**
     * Omit specific fields from the bus_owners
     */
    omit?: bus_ownersOmit<ExtArgs> | null
    /**
     * Filter, which bus_owners to fetch.
     */
    where?: bus_ownersWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of bus_owners to fetch.
     */
    orderBy?: bus_ownersOrderByWithRelationInput | bus_ownersOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for bus_owners.
     */
    cursor?: bus_ownersWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` bus_owners from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` bus_owners.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of bus_owners.
     */
    distinct?: Bus_ownersScalarFieldEnum | Bus_ownersScalarFieldEnum[]
  }

  /**
   * bus_owners findFirstOrThrow
   */
  export type bus_ownersFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the bus_owners
     */
    select?: bus_ownersSelect<ExtArgs> | null
    /**
     * Omit specific fields from the bus_owners
     */
    omit?: bus_ownersOmit<ExtArgs> | null
    /**
     * Filter, which bus_owners to fetch.
     */
    where?: bus_ownersWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of bus_owners to fetch.
     */
    orderBy?: bus_ownersOrderByWithRelationInput | bus_ownersOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for bus_owners.
     */
    cursor?: bus_ownersWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` bus_owners from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` bus_owners.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of bus_owners.
     */
    distinct?: Bus_ownersScalarFieldEnum | Bus_ownersScalarFieldEnum[]
  }

  /**
   * bus_owners findMany
   */
  export type bus_ownersFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the bus_owners
     */
    select?: bus_ownersSelect<ExtArgs> | null
    /**
     * Omit specific fields from the bus_owners
     */
    omit?: bus_ownersOmit<ExtArgs> | null
    /**
     * Filter, which bus_owners to fetch.
     */
    where?: bus_ownersWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of bus_owners to fetch.
     */
    orderBy?: bus_ownersOrderByWithRelationInput | bus_ownersOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing bus_owners.
     */
    cursor?: bus_ownersWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` bus_owners from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` bus_owners.
     */
    skip?: number
    distinct?: Bus_ownersScalarFieldEnum | Bus_ownersScalarFieldEnum[]
  }

  /**
   * bus_owners create
   */
  export type bus_ownersCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the bus_owners
     */
    select?: bus_ownersSelect<ExtArgs> | null
    /**
     * Omit specific fields from the bus_owners
     */
    omit?: bus_ownersOmit<ExtArgs> | null
    /**
     * The data needed to create a bus_owners.
     */
    data: XOR<bus_ownersCreateInput, bus_ownersUncheckedCreateInput>
  }

  /**
   * bus_owners createMany
   */
  export type bus_ownersCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many bus_owners.
     */
    data: bus_ownersCreateManyInput | bus_ownersCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * bus_owners createManyAndReturn
   */
  export type bus_ownersCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the bus_owners
     */
    select?: bus_ownersSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the bus_owners
     */
    omit?: bus_ownersOmit<ExtArgs> | null
    /**
     * The data used to create many bus_owners.
     */
    data: bus_ownersCreateManyInput | bus_ownersCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * bus_owners update
   */
  export type bus_ownersUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the bus_owners
     */
    select?: bus_ownersSelect<ExtArgs> | null
    /**
     * Omit specific fields from the bus_owners
     */
    omit?: bus_ownersOmit<ExtArgs> | null
    /**
     * The data needed to update a bus_owners.
     */
    data: XOR<bus_ownersUpdateInput, bus_ownersUncheckedUpdateInput>
    /**
     * Choose, which bus_owners to update.
     */
    where: bus_ownersWhereUniqueInput
  }

  /**
   * bus_owners updateMany
   */
  export type bus_ownersUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update bus_owners.
     */
    data: XOR<bus_ownersUpdateManyMutationInput, bus_ownersUncheckedUpdateManyInput>
    /**
     * Filter which bus_owners to update
     */
    where?: bus_ownersWhereInput
    /**
     * Limit how many bus_owners to update.
     */
    limit?: number
  }

  /**
   * bus_owners updateManyAndReturn
   */
  export type bus_ownersUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the bus_owners
     */
    select?: bus_ownersSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the bus_owners
     */
    omit?: bus_ownersOmit<ExtArgs> | null
    /**
     * The data used to update bus_owners.
     */
    data: XOR<bus_ownersUpdateManyMutationInput, bus_ownersUncheckedUpdateManyInput>
    /**
     * Filter which bus_owners to update
     */
    where?: bus_ownersWhereInput
    /**
     * Limit how many bus_owners to update.
     */
    limit?: number
  }

  /**
   * bus_owners upsert
   */
  export type bus_ownersUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the bus_owners
     */
    select?: bus_ownersSelect<ExtArgs> | null
    /**
     * Omit specific fields from the bus_owners
     */
    omit?: bus_ownersOmit<ExtArgs> | null
    /**
     * The filter to search for the bus_owners to update in case it exists.
     */
    where: bus_ownersWhereUniqueInput
    /**
     * In case the bus_owners found by the `where` argument doesn't exist, create a new bus_owners with this data.
     */
    create: XOR<bus_ownersCreateInput, bus_ownersUncheckedCreateInput>
    /**
     * In case the bus_owners was found with the provided `where` argument, update it with this data.
     */
    update: XOR<bus_ownersUpdateInput, bus_ownersUncheckedUpdateInput>
  }

  /**
   * bus_owners delete
   */
  export type bus_ownersDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the bus_owners
     */
    select?: bus_ownersSelect<ExtArgs> | null
    /**
     * Omit specific fields from the bus_owners
     */
    omit?: bus_ownersOmit<ExtArgs> | null
    /**
     * Filter which bus_owners to delete.
     */
    where: bus_ownersWhereUniqueInput
  }

  /**
   * bus_owners deleteMany
   */
  export type bus_ownersDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which bus_owners to delete
     */
    where?: bus_ownersWhereInput
    /**
     * Limit how many bus_owners to delete.
     */
    limit?: number
  }

  /**
   * bus_owners without action
   */
  export type bus_ownersDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the bus_owners
     */
    select?: bus_ownersSelect<ExtArgs> | null
    /**
     * Omit specific fields from the bus_owners
     */
    omit?: bus_ownersOmit<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const Bus_ownersScalarFieldEnum: {
    bus_owner_id: 'bus_owner_id',
    full_name: 'full_name',
    phone_number: 'phone_number',
    password_hash: 'password_hash',
    company_name: 'company_name',
    is_email_verified: 'is_email_verified',
    email_verification_token: 'email_verification_token',
    email_verification_expiry: 'email_verification_expiry',
    created_at: 'created_at',
    updated_at: 'updated_at'
  };

  export type Bus_ownersScalarFieldEnum = (typeof Bus_ownersScalarFieldEnum)[keyof typeof Bus_ownersScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    
  /**
   * Deep Input Types
   */


  export type bus_ownersWhereInput = {
    AND?: bus_ownersWhereInput | bus_ownersWhereInput[]
    OR?: bus_ownersWhereInput[]
    NOT?: bus_ownersWhereInput | bus_ownersWhereInput[]
    bus_owner_id?: IntFilter<"bus_owners"> | number
    full_name?: StringFilter<"bus_owners"> | string
    phone_number?: StringFilter<"bus_owners"> | string
    password_hash?: StringFilter<"bus_owners"> | string
    company_name?: StringNullableFilter<"bus_owners"> | string | null
    is_email_verified?: BoolFilter<"bus_owners"> | boolean
    email_verification_token?: StringNullableFilter<"bus_owners"> | string | null
    email_verification_expiry?: DateTimeNullableFilter<"bus_owners"> | Date | string | null
    created_at?: DateTimeFilter<"bus_owners"> | Date | string
    updated_at?: DateTimeFilter<"bus_owners"> | Date | string
  }

  export type bus_ownersOrderByWithRelationInput = {
    bus_owner_id?: SortOrder
    full_name?: SortOrder
    phone_number?: SortOrder
    password_hash?: SortOrder
    company_name?: SortOrderInput | SortOrder
    is_email_verified?: SortOrder
    email_verification_token?: SortOrderInput | SortOrder
    email_verification_expiry?: SortOrderInput | SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type bus_ownersWhereUniqueInput = Prisma.AtLeast<{
    bus_owner_id?: number
    phone_number?: string
    AND?: bus_ownersWhereInput | bus_ownersWhereInput[]
    OR?: bus_ownersWhereInput[]
    NOT?: bus_ownersWhereInput | bus_ownersWhereInput[]
    full_name?: StringFilter<"bus_owners"> | string
    password_hash?: StringFilter<"bus_owners"> | string
    company_name?: StringNullableFilter<"bus_owners"> | string | null
    is_email_verified?: BoolFilter<"bus_owners"> | boolean
    email_verification_token?: StringNullableFilter<"bus_owners"> | string | null
    email_verification_expiry?: DateTimeNullableFilter<"bus_owners"> | Date | string | null
    created_at?: DateTimeFilter<"bus_owners"> | Date | string
    updated_at?: DateTimeFilter<"bus_owners"> | Date | string
  }, "bus_owner_id" | "phone_number">

  export type bus_ownersOrderByWithAggregationInput = {
    bus_owner_id?: SortOrder
    full_name?: SortOrder
    phone_number?: SortOrder
    password_hash?: SortOrder
    company_name?: SortOrderInput | SortOrder
    is_email_verified?: SortOrder
    email_verification_token?: SortOrderInput | SortOrder
    email_verification_expiry?: SortOrderInput | SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
    _count?: bus_ownersCountOrderByAggregateInput
    _avg?: bus_ownersAvgOrderByAggregateInput
    _max?: bus_ownersMaxOrderByAggregateInput
    _min?: bus_ownersMinOrderByAggregateInput
    _sum?: bus_ownersSumOrderByAggregateInput
  }

  export type bus_ownersScalarWhereWithAggregatesInput = {
    AND?: bus_ownersScalarWhereWithAggregatesInput | bus_ownersScalarWhereWithAggregatesInput[]
    OR?: bus_ownersScalarWhereWithAggregatesInput[]
    NOT?: bus_ownersScalarWhereWithAggregatesInput | bus_ownersScalarWhereWithAggregatesInput[]
    bus_owner_id?: IntWithAggregatesFilter<"bus_owners"> | number
    full_name?: StringWithAggregatesFilter<"bus_owners"> | string
    phone_number?: StringWithAggregatesFilter<"bus_owners"> | string
    password_hash?: StringWithAggregatesFilter<"bus_owners"> | string
    company_name?: StringNullableWithAggregatesFilter<"bus_owners"> | string | null
    is_email_verified?: BoolWithAggregatesFilter<"bus_owners"> | boolean
    email_verification_token?: StringNullableWithAggregatesFilter<"bus_owners"> | string | null
    email_verification_expiry?: DateTimeNullableWithAggregatesFilter<"bus_owners"> | Date | string | null
    created_at?: DateTimeWithAggregatesFilter<"bus_owners"> | Date | string
    updated_at?: DateTimeWithAggregatesFilter<"bus_owners"> | Date | string
  }

  export type bus_ownersCreateInput = {
    full_name: string
    phone_number: string
    password_hash: string
    company_name?: string | null
    is_email_verified?: boolean
    email_verification_token?: string | null
    email_verification_expiry?: Date | string | null
    created_at?: Date | string
    updated_at?: Date | string
  }

  export type bus_ownersUncheckedCreateInput = {
    bus_owner_id?: number
    full_name: string
    phone_number: string
    password_hash: string
    company_name?: string | null
    is_email_verified?: boolean
    email_verification_token?: string | null
    email_verification_expiry?: Date | string | null
    created_at?: Date | string
    updated_at?: Date | string
  }

  export type bus_ownersUpdateInput = {
    full_name?: StringFieldUpdateOperationsInput | string
    phone_number?: StringFieldUpdateOperationsInput | string
    password_hash?: StringFieldUpdateOperationsInput | string
    company_name?: NullableStringFieldUpdateOperationsInput | string | null
    is_email_verified?: BoolFieldUpdateOperationsInput | boolean
    email_verification_token?: NullableStringFieldUpdateOperationsInput | string | null
    email_verification_expiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type bus_ownersUncheckedUpdateInput = {
    bus_owner_id?: IntFieldUpdateOperationsInput | number
    full_name?: StringFieldUpdateOperationsInput | string
    phone_number?: StringFieldUpdateOperationsInput | string
    password_hash?: StringFieldUpdateOperationsInput | string
    company_name?: NullableStringFieldUpdateOperationsInput | string | null
    is_email_verified?: BoolFieldUpdateOperationsInput | boolean
    email_verification_token?: NullableStringFieldUpdateOperationsInput | string | null
    email_verification_expiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type bus_ownersCreateManyInput = {
    bus_owner_id?: number
    full_name: string
    phone_number: string
    password_hash: string
    company_name?: string | null
    is_email_verified?: boolean
    email_verification_token?: string | null
    email_verification_expiry?: Date | string | null
    created_at?: Date | string
    updated_at?: Date | string
  }

  export type bus_ownersUpdateManyMutationInput = {
    full_name?: StringFieldUpdateOperationsInput | string
    phone_number?: StringFieldUpdateOperationsInput | string
    password_hash?: StringFieldUpdateOperationsInput | string
    company_name?: NullableStringFieldUpdateOperationsInput | string | null
    is_email_verified?: BoolFieldUpdateOperationsInput | boolean
    email_verification_token?: NullableStringFieldUpdateOperationsInput | string | null
    email_verification_expiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type bus_ownersUncheckedUpdateManyInput = {
    bus_owner_id?: IntFieldUpdateOperationsInput | number
    full_name?: StringFieldUpdateOperationsInput | string
    phone_number?: StringFieldUpdateOperationsInput | string
    password_hash?: StringFieldUpdateOperationsInput | string
    company_name?: NullableStringFieldUpdateOperationsInput | string | null
    is_email_verified?: BoolFieldUpdateOperationsInput | boolean
    email_verification_token?: NullableStringFieldUpdateOperationsInput | string | null
    email_verification_expiry?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type bus_ownersCountOrderByAggregateInput = {
    bus_owner_id?: SortOrder
    full_name?: SortOrder
    phone_number?: SortOrder
    password_hash?: SortOrder
    company_name?: SortOrder
    is_email_verified?: SortOrder
    email_verification_token?: SortOrder
    email_verification_expiry?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type bus_ownersAvgOrderByAggregateInput = {
    bus_owner_id?: SortOrder
  }

  export type bus_ownersMaxOrderByAggregateInput = {
    bus_owner_id?: SortOrder
    full_name?: SortOrder
    phone_number?: SortOrder
    password_hash?: SortOrder
    company_name?: SortOrder
    is_email_verified?: SortOrder
    email_verification_token?: SortOrder
    email_verification_expiry?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type bus_ownersMinOrderByAggregateInput = {
    bus_owner_id?: SortOrder
    full_name?: SortOrder
    phone_number?: SortOrder
    password_hash?: SortOrder
    company_name?: SortOrder
    is_email_verified?: SortOrder
    email_verification_token?: SortOrder
    email_verification_expiry?: SortOrder
    created_at?: SortOrder
    updated_at?: SortOrder
  }

  export type bus_ownersSumOrderByAggregateInput = {
    bus_owner_id?: SortOrder
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}