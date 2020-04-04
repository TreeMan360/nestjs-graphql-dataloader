# nestjs-graphql-dataloader

Based on https://github.com/krislefeber/nestjs-dataloader this small library assists in adding https://github.com/graphql/dataloader to a NestJS project.

This package also ensures that the ids are mapped to the dataloader in the correct sequence automatically and provides a helpful base class to simplify dataloader creation.

**Requires NestJS 7+**

## Installation

npm:
```
npm i nestjs-graphql-dataloader --save
```

yarn:
```
yarn add nestjs-graphql-dataloader
```

## Usage

### 1. Register DataLoaderInterceptor
First, register a NestJS interceptor in your applications root module(s) providers configuration. This can actually be placed in any of your modules and it will be available anywhere but I would recommend your root module(s). It only needs to be defined once.

Add: 
```javascript
{
  provide: APP_INTERCEPTOR,
  useClass: DataLoaderInterceptor,
}
```
    
For example:
```javascript
import { DataLoaderInterceptor } from 'nestjs-graphql-dataloader'
...

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: DataLoaderInterceptor,
    },
  ],
  
  ...
  imports: [
    RavenModule,
    ConfigModule.load(
      path.resolve(__dirname, '../../config', '**/!(*.d).{ts,js}'),
    ),
```

### 2. Build @Loaders for each @ObjectType

Using the provided template method, ```OrderedNestDataLoader<KeyType, EntityType>```, you can easily implement DataLoaders for your types. Here is an example:

```javascript
import { Injectable } from '@nestjs/common'
import { OrderedNestDataLoader } from 'nestjs-graphql-dataloader'
import { Location } from '../core/location.entity'
import { LocationService } from '../core/location.service'

@Injectable()
export class LocationLoader extends OrderedDataLoader<string, Location> {
  constructor(private readonly locationService: LocationService) {
    super()
  }

  protected getOptions = () => ({
    query: (keys: string[]) => this.locationService.findByIds(keys),
  })
}
```

Add these to your modules providers as usual. You will most likely want to include it in your modules exports so the loader can be imported by resolvers in other modules.

```getOptions``` takes a single ```options``` argument which has the following interface:

```javascript
interface IOrderedNestDataLoaderOptions<ID, Type> {
  propertyKey?: string;
  query: (keys: readonly ID[]) => Promise<Type[]>;
  typeName?: string;
}
```

Since the majority of the time a ```propertyKey``` is ```'id'``` this is the default if not specified. 

The ```typeName``` for the above example is automatically assigned ```'Location'``` which is derived from the class name, this is just used for logging errors.

The query is the equivalent of a ```repository.findByIds(ids)``` operation. It should return the **same number of elements** as requested. The **order does not matter** as the base loader implementation takes care of this.


### 3. Use the @Loader in @ResolveField

To then use the resolver it just needs to be injected into the resolvers field resolver method. Here is an example:

```javascript
import DataLoader from 'dataloader'
...

@ResolveField(returns => [Location])
public async locations(
  @Parent() company: Company,
  @Loader(LocationLoader)
  locationLoader: DataLoader<Location['id'], Location>,
) {
  return locationLoader.loadMany(company.locationIds)
}
```
