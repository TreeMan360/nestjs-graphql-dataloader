import {
  CallHandler,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  NestInterceptor,
  Type,
} from "@nestjs/common";
import {
  APP_INTERCEPTOR,
  ContextId,
  ContextIdFactory,
  ModuleRef,
} from "@nestjs/core";
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

interface DataLoaderFactory {
  (contextId: ContextId, type: Type<NestDataLoader<any, any>>): Promise<
    DataLoader<any, any>
  >;
}

export class NestDataLoaderContext {
  private readonly id: ContextId = ContextIdFactory.create();
  private readonly cache: Map<
    Type<NestDataLoader<any, any>>,
    Promise<DataLoader<any, any>>
  > = new Map<Type<NestDataLoader<any, any>>, Promise<DataLoader<any, any>>>();

  constructor(private readonly dataloaderFactory: DataLoaderFactory) {}

  async clearAll() {
    for (const loaderPromise of this.cache.values()) {
      const loader = await loaderPromise;
      loader.clearAll();
    }
  }

  getLoader(
    type: Type<NestDataLoader<any, any>>
  ): Promise<DataLoader<any, any>> {
    let loader = this.cache.get(type);
    if (!loader) {
      loader = this.dataloaderFactory(this.id, type);
      this.cache.set(type, loader);
    }

    return loader;
  }
}

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
      ctx[NEST_LOADER_CONTEXT_KEY] = new NestDataLoaderContext(
        this.createDataLoader.bind(this)
      );
    }

    return next.handle();
  }

  private async createDataLoader(
    contextId: ContextId,
    type: Type<NestDataLoader<any, any>>
  ): Promise<DataLoader<any, any>> {
    try {
      const provider = await this.moduleRef.resolve<NestDataLoader<any, any>>(
        type,
        contextId,
        { strict: false }
      );

      return provider.generateDataLoader();
    } catch (e) {
      throw new InternalServerErrorException(
        `The loader ${type} is not provided` + e
      );
    }
  }
}

function getNestDataLoaderContext(
  context: ExecutionContext
): NestDataLoaderContext {
  if (context.getType<GqlContextType>() !== "graphql") {
    throw new InternalServerErrorException(
      "@Loader should only be used within the GraphQL context"
    );
  }

  const graphqlContext = GqlExecutionContext.create(context).getContext();

  const nestDataLoaderContext = graphqlContext[NEST_LOADER_CONTEXT_KEY];
  if (!nestDataLoaderContext) {
    throw new InternalServerErrorException(
      `You should provide interceptor ${DataLoaderInterceptor.name} globally with ${APP_INTERCEPTOR}`
    );
  }

  return nestDataLoaderContext;
}

/**
 * The decorator to be used within your graphql method.
 */
export const Loader = createParamDecorator(
  // tslint:disable-next-line: ban-types
  (
    data: Type<NestDataLoader<any, any>>,
    context: ExecutionContext
  ): Promise<DataLoader<any, any>> => {
    if (!data) {
      throw new InternalServerErrorException(
        `No loader provided to @Loader ('${data}')`
      );
    }

    return getNestDataLoaderContext(context).getLoader(data);
  }
);

/**
 * The decorator to be used to get the data loader context
 */
export const LoaderContext = createParamDecorator(
  // tslint:disable-next-line: ban-types
  (data: any, context: ExecutionContext): NestDataLoaderContext => {
    return getNestDataLoaderContext(context);
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
