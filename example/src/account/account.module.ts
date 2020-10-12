import { Module } from "@nestjs/common";
import { AccountResolver } from "./account.resolver";
import { AccountService } from "./account.service";
import { Account } from "./account.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccountLoader } from "./account.loader";

@Module({
  imports: [TypeOrmModule.forFeature([Account])],
  providers: [
    AccountResolver,
    AccountService,
    AccountLoader
  ],
})
export class AccountModule {}
