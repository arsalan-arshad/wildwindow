import { Global, Module } from '@nestjs/common';

import { AccountService } from '../me/account.service.js';
import { MeController } from '../me/me.controller.js';
import { WatchlistController } from '../me/watchlist.controller.js';
import { WatchlistService } from '../me/watchlist.service.js';
import { UploadsModule } from '../uploads/uploads.module.js';

import { AdminRoleGuard } from './admin-role.guard.js';
import { FirebaseAdminTokenVerifier } from './firebase-admin.verifier.js';
import { FirebaseAuthGuard } from './firebase-auth.guard.js';
import { FIREBASE_TOKEN_VERIFIER } from './token-verifier.js';
import { UsersService } from './users.service.js';

@Global()
@Module({
  imports: [UploadsModule],
  controllers: [MeController, WatchlistController],
  providers: [
    UsersService,
    WatchlistService,
    AccountService,
    FirebaseAuthGuard,
    AdminRoleGuard,
    {
      provide: FIREBASE_TOKEN_VERIFIER,
      useClass: FirebaseAdminTokenVerifier,
    },
  ],
  exports: [
    UsersService,
    WatchlistService,
    AccountService,
    FirebaseAuthGuard,
    AdminRoleGuard,
    FIREBASE_TOKEN_VERIFIER,
  ],
})
export class AuthModule {}
