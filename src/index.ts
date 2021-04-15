import {
  CallHandler,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  NestInterceptor,
} from "@nestjs/common";
import { APP_INTERCEPTOR, ContextIdFactory, ModuleRef } from "@nestjs/core";
import { GqlContextType, GqlExecutionContext } from "@nestjs/graphql";
import DataLoader from "dataloader";
import { Observable } from "rxjs";

/**
 * This interface will be used to generate the initial data loader.
 * The concrete implementation should be added as a provider to your module.
 */
// tslint:disable-next-line: interface-name
export interface NestDataLoader<ID, Type> {
  /**
   * Should return a new instance of dataloader each time
   */
  generateDataLoader(): DataLoader<ID, Type>;
}

/**
 * Context key where get loader function will be stored.
 * This class should be added to your module providers like so:
 * {
 *     provide: APP_INTERCEPTOR,
 *     useClass: DataLoaderInterceptor,
 * },
 */
const NEST_LOADER_CONTEXT_KEY: string = "NEST_LOADER_CONTEXT_KEY";

@Injectable()
export class DataLoaderInterceptor implements NestInterceptor {
  constructor(private readonly moduleRef: ModuleRef) {}

  public intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<any> {
    if (context.getType<GqlContextType>() !== "graphql") {
      return next.handle();
    }

    const ctx = GqlExecutionContext.create(context).getContext();

    if (ctx[NEST_LOADER_CONTEXT_KEY] === undefined) {
      ctx[NEST_LOADER_CONTEXT_KEY] = {
        contextId: ContextIdFactory.create(),
        getLoader: (type: string): Promise<NestDataLoader<any, any>> => {
          if (ctx[type] === undefined) {
            try {
              ctx[type] = (async () => {
                return (
                  await this.moduleRef.resolve<NestDataLoader<any, any>>(
                    type,
                    ctx[NEST_LOADER_CONTEXT_KEY].contextId,
                    { strict: false }
                  )
                ).generateDataLoader();
              })();
            } catch (e) {
              throw new InternalServerErrorException(
                `The loader ${type} is not provided` + e
              );
            }
          }
          return ctx[type];
        },
      };
    }
    return next.handle();
  }
}

/**
 * The decorator to be used within your graphql method.
 */
export const Loader = createParamDecorator(
  // tslint:disable-next-line: ban-types
  (data: string | Function, context: ExecutionContext) => {
    const name = typeof data === "string" ? data : data?.name;
    if (!name) {
      throw new InternalServerErrorException(
        `Invalid name provider to @Loader ('${name}')`
      );
    }

    if (context.getType<GqlContextType>() !== "graphql") {
      throw new InternalServerErrorException(
        "@Loader should only be used within the GraphQL context"
      );
    }

    const ctx = GqlExecutionContext.create(context).getContext();
    if (!name || !ctx[NEST_LOADER_CONTEXT_KEY]) {
      throw new InternalServerErrorException(
        `You should provide interceptor ${DataLoaderInterceptor.name} globally with ${APP_INTERCEPTOR}`
      );
    }

    return ctx[NEST_LOADER_CONTEXT_KEY].getLoader(name);
  }
);

// https://github.com/graphql/dataloader/issues/66#issuecomment-386252044
export const ensureOrder = (options) => {
  const {
    docs,
    keys,
    prop,
    error = (key) => `Document does not exist (${key})`,
  } = options;
  // Put documents (docs) into a map where key is a document's ID or some
  // property (prop) of a document and value is a document.
  const docsMap = new Map();
  docs.forEach((doc) => docsMap.set(doc[prop], doc));
  // Loop through the keys and for each one retrieve proper document. For not
  // existing documents generate an error.
  return keys.map((key) => {
    return (
      docsMap.get(key) ||
      new Error(typeof error === "function" ? error(key) : error)
    );
  });
};

interface IOrderedNestDataLoaderOptions<ID, Type> {
  propertyKey?: string;
  query: (keys: readonly ID[]) => Promise<Type[]>;
  typeName?: string;
  dataloaderConfig?: DataLoader.Options<ID, Type>;
}

// tslint:disable-next-line: max-classes-per-file
export abstract class OrderedNestDataLoader<ID, Type>
  implements NestDataLoader<ID, Type> {
  protected abstract getOptions: () => IOrderedNestDataLoaderOptions<ID, Type>;

  public generateDataLoader() {
    return this.createLoader(this.getOptions());
  }

  protected createLoader(
    options: IOrderedNestDataLoaderOptions<ID, Type>
  ): DataLoader<ID, Type> {
    const defaultTypeName = this.constructor.name.replace("Loader", "");
    return new DataLoader<ID, Type>(async (keys) => {
      return ensureOrder({
        docs: await options.query(keys),
        keys,
        prop: options.propertyKey || "id",
        error: (keyValue) =>
          `${options.typeName || defaultTypeName} does not exist (${keyValue})`,
      });
    }, options.dataloaderConfig);
  }
}
