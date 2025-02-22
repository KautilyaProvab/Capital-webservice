import { Controller, Post, Body, UploadedFiles, UseInterceptors, Param, Res, Get, UseGuards, Req, HttpCode } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express/multer/interceptors/files.interceptor';
import { getExceptionClassByCode } from '../../all-exception.filter';
import { HomeService } from './home.service';
import { diskStorage } from 'multer';
import { getConnection } from "typeorm";
import { editFileName, imageFileFilter } from '../../app.helper';
import { AuthGuard } from '@nestjs/passport';

@Controller('user-profile')
export class HomeController {

    conn = getConnection();

    constructor(
        private readonly homeService: HomeService
    ) { }

    @Post()
    async getCoreCities(@Body() body: any): Promise<any> {
        const result = await this.homeService.getCoreCities(body);
        return result;
    }

    @Post('getUserProfile')
    @UseGuards(AuthGuard('jwt'))
    async getUserProfile(@Req() req: any): Promise<any> {
        return await this.homeService.getUserProfile(req);
    }

    @Post('updateProfile')
    @UseGuards(AuthGuard('jwt'))
    async updateProfile(@Body() body: any, @Req() req: any): Promise<any> {
        return await this.homeService.updateUserProfile(body, req);
    }
    
    @Post('getUserByEmail')
    @UseGuards(AuthGuard('jwt'))
    async getUserByEmail(@Body() body: any): Promise<any> {
        return await this.homeService.getUserByEmail(body);
    }
    @Post('uploadUserProfilePhoto')
    @UseGuards(AuthGuard('jwt'))
    @UseInterceptors(
        FilesInterceptor('image', 20, {
            storage: diskStorage({
                destination: './uploads/user/user-profile',
                filename: editFileName,
            }),
            fileFilter: imageFileFilter,
        }),
    )
    async uploadUserProfilePhoto(@UploadedFiles() files, @Body() body: any, @Req() req: any) {
        const response = [];
        const images = [];
        files.forEach(file => {
            const fileReponse = {
                originalname: file.originalname,
                filename: file.filename,
            };
            response.push(fileReponse);
            images.push('("/user-profile/uploads/user/user-profile/' + file.filename + '")');
        });
        try {
            const values = images.join(', ');
            const query = `UPDATE auth_users SET image = ${values} WHERE id = ${req.user.id};`;
            const result = await this.conn.query(query);
            if (result) {
                return { image_url: `http://54.198.46.240/webservice/user-profile/uploads/user/user-profile/${response[0].filename}` }
                // return res.sendFile(response[0].filename, { root: './uploads/user/user-profile' });
            }
        } catch (error) {
            const errorClass: any = getExceptionClassByCode(error.message);
            throw new errorClass(error.message);
        }
    }

    @Get('/uploads/user/user-profile/:imgpath')
    @HttpCode(200)
    seeUploadedFile(@Param('imgpath') image, @Res() res) {
        return res.sendFile(image, { root: './uploads/user/user-profile' });
    }

    @Post('updateStatus')
    @UseGuards(AuthGuard('jwt'))
    async updateStatus(@Body() body: any, @Req() req: any): Promise<any> {
        return await this.homeService.updateStatus(body, req);
    }
}
