import { MailerOptions } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';

export const mailerConfig: MailerOptions = {
    transport: {
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT),
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    },
    defaults: {
        from: process.env.EMAIL_FROM
    },
    template: {
        dir: join(process.cwd(), 'dist/templates'), // Update template path
        adapter: new HandlebarsAdapter(),
        options: {
            strict: true
        }
    }
};
