import { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import DataLoader from "dataloader";
import { Observable } from "rxjs";
export interface NestDataLoader<ID, Type> {
    generateDataLoader(): DataLoader<ID, Type>;
}
export declare class DataLoaderInterceptor implements NestInterceptor {
    private readonly moduleRef;
    constructor(moduleRef: ModuleRef);
    intercept(context: ExecutionContext, next: CallHandler): Observable<any>;
}
export declare const Loader: (...dataOrPipes: (string | Function | import("@nestjs/common").PipeTransform<any, any> | import("@nestjs/common").Type<import("@nestjs/common").PipeTransform<any, any>>)[]) => ParameterDecorator;
export declare const ensureOrder: (options: any) => any;
interface IOrderedNestDataLoaderOptions<ID, Type> {
    propertyKey?: string;
    query: (keys: readonly ID[]) => Promise<Type[]>;
    typeName?: string;
    dataloaderConfig?: DataLoader.Options<ID, Type>;
}
export declare abstract class OrderedNestDataLoader<ID, Type> implements NestDataLoader<ID, Type> {
    protected abstract getOptions: () => IOrderedNestDataLoaderOptions<ID, Type>;
    generateDataLoader(): DataLoader<ID, Type, ID>;
    protected createLoader(options: IOrderedNestDataLoaderOptions<ID, Type>): DataLoader<ID, Type>;
}
export {};
