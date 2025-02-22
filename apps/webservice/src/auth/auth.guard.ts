import { Reflector } from "@nestjs/core";
import { ExecutionContext, Injectable, SetMetadata } from "@nestjs/common";
import { AuthGuard as PassportAuthGaurd } from "@nestjs/passport";

export const Public = () => SetMetadata( "isPublic", true );

@Injectable()
export class AuthGuard extends PassportAuthGaurd('jwt') {
    public constructor(private readonly reflector: Reflector) {
        super();
	}

	async canActivate( context: ExecutionContext ): Promise<any> {
		const isPublic = this.reflector.get<boolean>( "isPublic", context.getHandler() ) || this.reflector.get<boolean>( "isPublic", context.getClass() );
		if ( isPublic ) {
			return true;
        }
        return await super.canActivate(context);
	}
}