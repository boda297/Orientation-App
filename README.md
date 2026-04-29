# Orientation App Backend

This is the backend API for the **Orientation App**, built with [NestJS](https://nestjs.com/). It provides RESTful endpoints to support user authentication, role-based access control, project and content management, and media handling.

## Features

- **Authentication & Authorization**: Secure JWT-based authentication with strict Role-Based Access Control (RBAC) (e.g., Superadmin vs. Admin).
- **Database**: MongoDB integration using Mongoose for scalable and flexible data storage.
- **Media Management**: Integration with AWS S3 for robust file, image, and video uploads. Includes utilities for extracting video duration.
- **Email Services**: Email delivery configured via Nodemailer.
- **Data Validation**: Comprehensive input validation and transformation using `class-validator` and `class-transformer`.
- **CORS Configured**: Production-ready CORS policies configured for the frontend domains (e.g., `orientationapps.com`).

## Tech Stack

- **Framework**: [NestJS](https://nestjs.com/) (Node.js/TypeScript)
- **Database**: [MongoDB](https://www.mongodb.com/) & [Mongoose](https://mongoosejs.com/)
- **Authentication**: [Passport.js](http://www.passportjs.org/) (JWT Strategy), bcrypt
- **Cloud Storage**: AWS S3 (`@aws-sdk/client-s3`)
- **Email**: [Nodemailer](https://nodemailer.com/)

## Project Setup

```bash
# Install dependencies
$ npm install
```

## Running the application

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Running tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## License

This project is UNLICENSED.
