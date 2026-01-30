# API Routes Documentation

This document contains all routes in the Orientation App Backend project, including request and response data structures.

**Base URL**: `/` (configurable via PORT environment variable, default: 3000)

---

## 1. App Controller

### GET `/`

**Description**: Returns a simple hello world message  
**Authentication**: None  
**Request**: None  
**Response**:

```typescript
string; // "Hello World!"
```

---

## 2. Auth Controller (`/auth`)

### POST `/auth/register`

**Description**: Register a new user (unverified). Sends 4-digit OTP to email for verification.  
**Authentication**: None  
**Request Body** (`RegisterDto`):

```typescript
{
  username: string; // Required
  email: string; // Valid email address (required)
  phoneNumber?: string; // Valid phone number (optional)
  password: string; // 8-20 characters (required)
}
```

**Response**:

```typescript
{
  success: boolean; // true
  message: string; // "Registration successful. Please check your email for verification code."
  email: string; // User's email address
}
```

**Note**: User CANNOT login until email is verified via OTP. OTP expires in 2 minutes.

---

### POST `/auth/verify-email`

**Description**: Verify email with 4-digit OTP.  
**Authentication**: None  
**Request Body**:

```typescript
{
  email: string; // Valid email address (required)
  otp: string; // 4-digit OTP (required)
}
```

**Response**:

```typescript
{
  success: boolean; // true
  message: string; // "Email verified successfully"
}
```

**Error Responses**:

- `400 Bad Request`: Invalid verification code
- `400 Bad Request`: Verification code has expired
- `400 Bad Request`: Email already verified

---

### POST `/auth/resend-verification`

**Description**: Resend verification OTP to email  
**Authentication**: None  
**Request Body**:

```typescript
{
  email: string; // Valid email address (required)
}
```

**Response**:

```typescript
{
  success: boolean; // true
  message: string; // "Verification code sent to your email"
}
```

---

### POST `/auth/login`

**Description**: Login endpoint for VERIFIED users only  
**Authentication**: None  
**Request Body** (`LoginDto`):

```typescript
{
  email: string; // Valid email address (required)
  password: string; // 8-20 characters (required)
}
```

**Response**:

```typescript
{
  user: {
    _id: string;
    username: string;
    email: string;
    phoneNumber: string;
    savedProjects: string[];
    role: string;
    isEmailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  accessToken: string;   // Short-lived JWT access token (default: 15 minutes)
  refreshToken: string;  // Long-lived refresh token (default: 7 days)
}
```

**Error Responses**:

- `401 Unauthorized`: Invalid credentials
- `401 Unauthorized`: "Please verify your email before logging in"

---

### POST `/auth/forgot-password`

**Description**: Request password reset. Sends 4-digit OTP to email.  
**Authentication**: None  
**Request Body**:

```typescript
{
  email: string; // Valid email address (required)
}
```

**Response**:

```typescript
{
  success: boolean; // true
  message: string; // "Password reset code sent to your email"
}
```

**Note**: Response doesn't reveal if email exists for security.

---

### POST `/auth/verify-reset-otp`

**Description**: Verify password reset OTP (optional step before reset).  
**Authentication**: None  
**Request Body**:

```typescript
{
  email: string; // Valid email address (required)
  otp: string; // 4-digit OTP (required)
}
```

**Response**:

```typescript
{
  success: boolean; // true
  message: string; // "OTP verified. You can now reset your password."
}
```

**Error Responses**:

- `400 Bad Request`: Invalid reset code
- `400 Bad Request`: Reset code has expired

---

### POST `/auth/reset-password`

**Description**: Reset password using email and OTP  
**Authentication**: None  
**Request Body**:

```typescript
{
  email: string; // Valid email address (required)
  otp: string; // 4-digit OTP (required)
  newPassword: string; // New password (required)
}
```

**Response**:

```typescript
{
  success: boolean; // true
  message: string; // "Password reset successfully"
}
```

**Error Responses**:

- `400 Bad Request`: Invalid reset code
- `400 Bad Request`: Reset code has expired

**Note**: All refresh tokens are invalidated after password reset (logged out of all devices).

---

### POST `/auth/refresh`

**Description**: Refresh tokens using rotation (single-use refresh tokens)  
**Authentication**: None  
**Request Body** (`RefreshTokenDto`):

```typescript
{
  refreshToken: string; // Current refresh token (required)
}
```

**Response**:

```typescript
{
  accessToken: string; // New short-lived access token
  refreshToken: string; // New refresh token (old one is invalidated)
}
```

**Error Responses**:

- `401 Unauthorized`: Invalid or expired refresh token
- `401 Unauthorized`: "Refresh token reuse detected. All sessions have been revoked."

---

### POST `/auth/logout`

**Description**: Logout from current session (revoke refresh token)  
**Authentication**: None  
**Request Body** (`RefreshTokenDto`):

```typescript
{
  refreshToken: string; // Current refresh token (required)
}
```

**Response**:

```typescript
{
  message: string; // "Logged out successfully"
}
```

---

### POST `/auth/logout-all`

**Description**: Logout from all devices (revoke all refresh tokens for the user)  
**Authentication**: Required (`AuthGuard`)  
**Request**: None (user ID extracted from access token)

**Response**:

```typescript
{
  message: string; // "Logged out from all devices successfully"
}
```

---

### GET `/auth/sessions`

**Description**: Get all active sessions for the current user  
**Authentication**: Required (`AuthGuard`)  
**Request**: None (user ID extracted from access token)

**Response**:

````typescript
[
  {
    _id: string;
    deviceInfo: string;  // User-Agent string
    ipAddress: string;   // Client IP address
    createdAt: Date;     // Session start time
    expiresAt: Date;     // Session expiry time
  }
]

---

### POST `/auth/cleanup-unverified`

**Description**: Cleanup unverified users with expired OTPs (Manual or Cron)
**Authentication**: None (Public)
**Request**: None
**Response**:

```typescript
{
  success: boolean; // true
  message: string;  // "Cleaned up X unverified users with expired OTPs"
  deletedCount: number;
}
````

````

---

## 3. Users Controller (`/users`)

### POST `/users`

**Description**: Create a new admin user
**Authentication**: Required (`AuthGuard`, `RolesGuard`)
**Required Role**: `SUPERADMIN`
**Request Body** (`CreateUserDto`):

```typescript
{
  username: string; // Required
  email: string; // Valid email address (required)
  phoneNumber: string; // Valid phone number (required)
  password: string; // 8-20 characters, must contain: uppercase, lowercase, number, special char (required)
}
````

**Response**: User object (from service)

---

### GET `/users`

**Description**: Get all users  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `SUPERADMIN` or `ADMIN`  
**Request**: None  
**Response**: Array of user objects

---

### GET `/users/profile`

**Description**: Get current user profile
**Authentication**: Required (`AuthGuard`)
**Required Role**: Any authenticated user
**Request**: None
**Response**: User object

---

### PATCH `/users/profile`

**Description**: Update current user profile
**Authentication**: Required (`AuthGuard`)
**Required Role**: Any authenticated user
**Request Body** (`UpdateUserDto` - all fields optional):

```typescript
{
  username?: string;
  email?: string;
  phoneNumber?: string;
  password?: string;  // 8-20 characters with complexity requirements
}
```

**Response**: Updated user object

---

### GET `/users/:id`

**Description**: Get a user by ID  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `SUPERADMIN` or `ADMIN`  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Response**: User object

---

### PATCH `/users/:id`

**Description**: Update a user (Admin)
**Authentication**: Required (`AuthGuard`, `RolesGuard`)
**Required Role**: `SUPERADMIN` or `ADMIN`
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Request Body** (`UpdateUserDto` - all fields optional):

```typescript
{
  username?: string;
  email?: string;
  phoneNumber?: string;
  password?: string;  // 8-20 characters with complexity requirements
}
```

**Response**: Updated user object

---

### DELETE `/users/:id`

**Description**: Delete a user  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `SUPERADMIN`  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Response**: Deletion confirmation

---

## 4. Projects Controller (`/projects`)

### POST `/projects`

**Description**: Create a new project  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `SUPERADMIN` or `ADMIN`  
**Request Type**: `multipart/form-data`  
**Request Body** (`CreateProjectDto`):

```typescript
{
  title: string;                    // Required
  developer: string;                // MongoDB ObjectId (required)
  location: string;                 // Required
  status?: string;                  // 'PLANNING' | 'CONSTRUCTION' | 'COMPLETED' | 'DELIVERED'
  script: string;                   // Required
  episodes?: any;                   // Optional
  reels?: any;                      // Optional
  inventory?: string;               // MongoDB ObjectId (optional)
  pdf?: string[];                   // Array of MongoDB ObjectIds (optional)
  whatsappNumber?: string;          // Valid phone number (optional)
  featured?: boolean;               // Optional
  mapsLocation?: string;            // Optional
  published?: boolean;              // Optional
}
```

**Files**:

- `logo`: File (max 1GB, single file, optional)
- `heroVideo`: File (max 1GB, single file, required)
- `projectThumbnail`: File (max 1GB, single file, optional)

**Response**: Project object

---

### GET `/projects`

**Description**: List/search projects with optional filters and pagination. Main listing endpoint.  
**Authentication**: None  
**Query Parameters** (`QueryProjectDto`):

```typescript
{
  developerId?: string;  // MongoDB ObjectId (optional) - filter by developer
  location?: string;     // Optional - filter by location
  status?: string;       // 'PLANNING' | 'CONSTRUCTION' | 'COMPLETED' | 'DELIVERED'
  title?: string;       // Optional - filter by title
  slug?: string;        // Optional - filter by slug
  limit?: number;       // 1-100 (optional) - page size
  page?: number;        // min 1 (optional) - page number (used with limit)
  sortBy?: string;      // 'newest' | 'trending' | 'saveCount' | 'viewCount' (optional)
}
```

**Response**: Array of project objects with basic fields:

```typescript
Array<{
  _id: string;
  title: string;
  location: string;
  projectThumbnailUrl: string;
}>;
```

Results are filtered by non-deleted projects (`deletedAt: null`), optionally filtered by query params, paginated when `limit`/`page` are provided, and sorted (default: newest first).

**Note**: Specific routes like `GET /projects/featured`, `GET /projects/location`, etc. must be defined before `GET /projects/:id` in the controller so they are matched correctly.

---

### GET `/projects/:id`

**Description**: Get a project by ID. Returns project with populated `developer`, `episodes`, `reels`, `inventory`, and `pdf` fields. Automatically increments view count.  
**Authentication**: None  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Response**: Project object with populated references:

```typescript
{
  _id: string;
  title: string;
  slug: string;
  logoUrl?: string;
  location: string;
  status: 'PLANNING' | 'CONSTRUCTION' | 'COMPLETED' | 'DELIVERED';
  developer: { _id: string; name: string; logoUrl?: string };
  script: string;
  episodes: Array<{ _id: string; title: string; thumbnail?: string; episodeUrl: string }>;
  reels: Array<{ _id: string; videoUrl: string; thumbnail?: string }>;
  inventory?: { _id: string; title: string; inventoryUrl: string };
  pdf: Array<{ _id: string; title: string; pdfUrl: string }>;
  projectThumbnailUrl: string;
  heroVideoUrl: string;
  whatsappNumber?: string;
  trendingScore: number;
  saveCount: number;
  viewCount: number;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### GET `/projects/featured?limit=10`

**Description**: Get featured projects  
**Authentication**: None  
**Query Parameters**:

```typescript
{
  limit?: string;  // Converted to number, default: 10
}
```

**Response**: Array of featured project objects (title, logoUrl, projectThumbnailUrl, location)

---

### GET `/projects/saved`

**Description**: Get projects saved by the current user
**Authentication**: Required (`AuthGuard`)
**Required Role**: Any authenticated user
**Request**: None
**Note**: User ID is extracted from JWT token (`req.user.sub`)
**Response**: Array of saved project objects (id, title, location, projectThumbnailUrl)

---

### GET `/projects/location?location=North%20Coast`

**Description**: Get projects by location  
**Authentication**: None  
**Query Parameters**:

```typescript
{
  location: string; // Required
}
```

**Response**: Array of project objects filtered by location (title, logoUrl, projectThumbnailUrl, location)

---

### GET `/projects/status?status=CONSTRUCTION`

**Description**: Get projects by status  
**Authentication**: None  
**Query Parameters**:

```typescript
{
  status: string; // 'PLANNING' | 'CONSTRUCTION' | 'COMPLETED' | 'DELIVERED'
}
```

**Response**: Array of project objects filtered by status (title, logoUrl, projectThumbnailUrl, location)

---

### GET `/projects/title?title=Direction%20White`

**Description**: Get projects by title  
**Authentication**: None  
**Query Parameters**:

```typescript
{
  title: string; // Required
}
```

**Response**: Array of project objects filtered by title (title, logoUrl, projectThumbnailUrl, location)

---

### GET `/projects/trending`

**Description**: Get trending projects  
**Authentication**: None  
**Query Parameters**:

```typescript
{
  limit?: string;  // Converted to number, default: 10
}
```

**Response**: Array of trending project objects with rank

---

### PATCH `/projects/:id`

**Description**: Update a project  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `SUPERADMIN` or `ADMIN`  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Request Type**: `multipart/form-data`  
**Request Body** (`UpdateProjectDto` - all fields optional):

```typescript
{
  title?: string;
  developer?: string;                // MongoDB ObjectId
  location?: string;
  status?: 'PLANNING' | 'CONSTRUCTION' | 'COMPLETED' | 'DELIVERED';
  script?: string;
  featured?: boolean;
  mapsLocation?: string;
  whatsappNumber?: string;
  inventory?: string;                // MongoDB ObjectId
  pdf?: string[];                    // Array of MongoDB ObjectIds
  published?: boolean;
}
```

**Files** (optional - if provided, replaces the old file in S3):

- `logo`: File (max 1GB, single file, optional) - replaces old logo
- `heroVideo`: File (max 1GB, single file, optional) - replaces old hero video
- `projectThumbnail`: File (max 1GB, single file, optional) - replaces old thumbnail

**Response**: Updated project object

---

### DELETE `/projects/:id`

**Description**: Delete a project  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `SUPERADMIN` or `ADMIN`  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Response**: Deletion confirmation

---

### PATCH `/projects/:id/increment-view`

**Description**: Increment view count for a project  
**Authentication**: Required (`AuthGuard`)  
**Required Role**: Any authenticated user  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Response**: Updated project object with incremented viewCount

---

### PATCH `/projects/:id/save-project`

**Description**: Save a project to user's saved projects  
**Authentication**: Required (`AuthGuard`)  
**Required Role**: Any authenticated user  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Note**: User ID is extracted from JWT token (`req.user.sub`)

**Response**: Updated user object with project added to savedProjects

---

### PATCH `/projects/:id/unsave-project`

**Description**: Remove a project from user's saved projects  
**Authentication**: Required (`AuthGuard`)  
**Required Role**: Any authenticated user  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Note**: User ID is extracted from JWT token (`req.user.sub`)

**Response**: Updated user object with project removed from savedProjects

---

### PUT `/projects/:id/publish`

**Description**: Publish a project  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `SUPERADMIN` or `ADMIN`  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Response**:

```typescript
{
  message: string; // "Project published successfully"
  project: Project; // Updated project object with published=true and publishedAt=current timestamp
}
```

---

### PUT `/projects/:id/unpublish`

**Description**: Unpublish a project  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `SUPERADMIN` or `ADMIN`  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Response**:

```typescript
{
  message: string; // "Project unpublished successfully"
  project: Project; // Updated project object with published=false and publishedAt=null
}
```

---

## 5. Developer Controller (`/developer`)

### GET `/developer`

**Description**: Get all developers  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `ADMIN` or `SUPERADMIN`  
**Request**: None  
**Response**: Array of developer objects

---

### GET `/developer/me/profile`

**Description**: Get current developer profile
**Authentication**: Required (`AuthGuard`, `RolesGuard`)
**Required Role**: `DEVELOPER`
**Request**: None
**Response**: Developer object

---

### GET `/developer/me/projects`

**Description**: Get current developer's projects
**Authentication**: Required (`AuthGuard`, `RolesGuard`)
**Required Role**: `DEVELOPER`
**Request**: None
**Response**: Array of project objects

---

### PATCH `/developer/me/profile`

**Description**: Update current developer profile
**Authentication**: Required (`AuthGuard`, `RolesGuard`)
**Required Role**: `DEVELOPER`
**Request Body** (`UpdateDeveloperDto`): Same as `PATCH /developer/:id`
**Response**: Updated developer object

---

### POST `/developer/create-account`

**Description**: Create a user account for an existing developer entity
**Authentication**: Required (`AuthGuard`, `RolesGuard`)
**Required Role**: `ADMIN` or `SUPERADMIN`
**Request Body** (`CreateDeveloperAccountDto`):

```typescript
{
  developerId: string; // Valid MongoDB ObjectId (required)
  password: string; // 8-20 chars, complex (required)
}
```

**Response**: User object

---

### POST `/developer/:developerId/link-user/:userId`

**Description**: Link an existing user to a developer
**Authentication**: Required (`AuthGuard`, `RolesGuard`)
**Required Role**: `ADMIN` or `SUPERADMIN`
**Response**: Updated developer object

---

### DELETE `/developer/:developerId/unlink-user`

**Description**: Unlink user from a developer
**Authentication**: Required (`AuthGuard`, `RolesGuard`)
**Required Role**: `ADMIN` or `SUPERADMIN`
**Response**: Updated developer object

---

### GET `/developer/:id`

**Description**: Get a developer by ID  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `ADMIN` or `SUPERADMIN`  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Response**: Developer object

---

### POST `/developer`

**Description**: Create a new developer  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `ADMIN` or `SUPERADMIN`  
**Request Type**: `multipart/form-data`  
**Request Body** (`CreateDeveloperDto`):

```typescript
{
  name: string;              // Required
  email?: string;            // Valid email address (optional)
  phone?: string;            // Optional
  socialMediaLink?: string;  // Optional
  location: string;          // Required
}
```

**Files**:

- `logo`: File (single file, optional)

**Response**: Developer object

---

### POST `/developer/join-developer`

**Description**: Submit a "join developer" request. The backend sends the submitted data to `ADMIN_NOTIFICATION_EMAIL` via SMTP.  
**Authentication**: Required (`JwtAuthGuard`)  
**Request Body** (`JoinDeveloperDto`):

```typescript
{
  name: string;            // Required
  address: string;         // Required
  phoneNumber: string;     // Required
  numberOfProjects: number; // Required
  socialmediaLink: string; // Required (URL)
  notes?: string;          // Optional
}
```

**Response**:

```typescript
{
  message: string; // "Join developer request sent successfully"
}
```

**Note**: Configure `ADMIN_NOTIFICATION_EMAIL` in `.env` to receive requests.

---

### PATCH `/developer/:id`

**Description**: Update a developer  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `ADMIN` or `SUPERADMIN`  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Request Body** (`UpdateDeveloperDto` - all fields optional):

```typescript
{
  name?: string;
  email?: string;
  phone?: string;
  socialMediaLink?: string;
  location?: string;
}
```

**Response**: Updated developer object

---

### PATCH `/developer/:id/project`

**Description**: Update developer's project script  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `DEVELOPER`, `ADMIN`, or `SUPERADMIN`  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Request Body** (`UpdateDeveloperScriptDto`):

```typescript
{
  script: string; // Required
}
```

**Response**: Updated developer object

---

### DELETE `/developer/:id`

**Description**: Delete a developer  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `ADMIN` or `SUPERADMIN`  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Response**: Deletion confirmation

---

## 6. Episode Controller (`/episode`)

### POST `/episode`

**Description**: Upload/create a new episode  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `ADMIN` or `SUPERADMIN`  
**Request Type**: `multipart/form-data`  
**Request Body** (`CreateEpisodeDto`):

```typescript
{
  projectId: string;      // MongoDB ObjectId (required)
  title: string;          // Required
  thumbnail?: string;     // Optional
  episodeOrder: string;   // Required
  duration: string;       // Required
}
```

**Files**:

- `file`: Video file (max 5GB, required)

**Note**: User ID is extracted from JWT token (`req.user.sub`)

**Response**:

```typescript
{
  message: string; // "Episode uploaded successfully"
  episode: Episode; // Created episode object
}
```

---

### GET `/episode`

**Description**: Get all episodes  
**Authentication**: None  
**Request**: None  
**Response**: Array of episode objects

---

### GET `/episode/:id`

**Description**: Get an episode by ID  
**Authentication**: None  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Response**: Episode object

---

### PATCH `/episode/:id`

**Description**: Update an episode (with optional file replacement)  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `ADMIN` or `SUPERADMIN`  
**Request Type**: `multipart/form-data`  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Request Body** (`UpdateEpisodeDto` - all fields optional):

```typescript
{
  title?: string;
  episodeOrder?: number;   // Min: 1
  duration?: number;       // Min: 0
}
```

**Files** (optional - if provided, replaces the old file in S3):

- `episodeFile`: Video file (max 5GB, optional) - replaces old episode video
- `thumbnail`: Thumbnail image file (optional) - replaces old thumbnail

**Response**:

```typescript
{
  message: string; // "Episode updated successfully"
  episode: Episode; // Updated episode object
}
```

**Note**: When a new file is uploaded, the old file is automatically deleted from S3.

---

### DELETE `/episode/:id`

**Description**: Delete an episode  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `ADMIN` or `SUPERADMIN`  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Response**:

```typescript
{
  message: string; // Deletion confirmation message
}
```

---

## 7. Reels Controller (`/reels`)

### POST `/reels`

**Description**: Upload a new reel with video and thumbnail  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `ADMIN` or `SUPERADMIN`  
**Request Type**: `multipart/form-data`  
**Request Body** (`CreateReelDto`):

```typescript
{
  title: string; // Required
  projectId: string; // MongoDB ObjectId (required)
}
```

**Files**:

- `file`: Video file (max 5GB, required)
- `thumbnail`: Thumbnail image file (required)

**Response**:

```typescript
{
  message: string; // "Reel uploaded successfully"
  reel: Reel; // Created reel object
}
```

---

### GET `/reels`

**Description**: Get all reels  
**Authentication**: None  
**Request**: None  
**Response**: Array of reel objects

---

### GET `/reels/saved`

**Description**: Get all reels saved by the current user  
**Authentication**: Required (`AuthGuard`)  
**Required Role**: Any authenticated user  
**Request**: None  
**Note**: User ID is extracted from JWT token (`req.user.sub`)

**Response**:

```typescript
{
  message: string; // "Saved reels fetched successfully"
  reels: Array<{ _id: string; title: string; thumbnail: string }>;
}
```

---

### GET `/reels/:id`

**Description**: Get a reel by ID  
**Authentication**: None  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Response**: Reel object

---

### PATCH `/reels/:id`

**Description**: Update a reel  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `ADMIN` or `SUPERADMIN`  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Request Body** (`UpdateReelDto` - all fields optional):

```typescript
{
  title?: string;
  projectId?: string;     // MongoDB ObjectId
}
```

**Response**: Updated reel object

---

### DELETE `/reels/:id`

**Description**: Delete a reel  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `ADMIN` or `SUPERADMIN`  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Response**:

```typescript
{
  message: string; // Deletion confirmation message
}
```

---

### POST `/reels/:id/save`

**Description**: Save a reel to user's saved reels  
**Authentication**: Required (`AuthGuard`)  
**Required Role**: Any authenticated user  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Note**: User ID is extracted from JWT token (`req.user.sub`)

**Response**:

```typescript
{
  message: string; // Success message
}
```

---

### POST `/reels/:id/unsave`

**Description**: Remove a reel from user's saved reels  
**Authentication**: Required (`AuthGuard`)  
**Required Role**: Any authenticated user  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Note**: User ID is extracted from JWT token (`req.user.sub`)

**Response**:

```typescript
{
  message: string; // Success message
}
```

---

## 8. S3/Upload Controller (`/upload`)

### POST `/upload`

**Description**: Upload a file to S3  
**Authentication**: None  
**Request Type**: `multipart/form-data`  
**Request Body**:

```typescript
{
  folder?: 'episodes' | 'reels' | 'images' | 'PDF';  // Optional, defaults to 'images'
}
```

**Files**:

- `file`: File (required)
  - Max size: 100MB
  - Allowed types: jpg, jpeg, png, gif, pdf, mp4, mov, avi, mp3, wav

**Response**:

```typescript
{
  success: true;
  message: 'File uploaded successfully';
  data: {
    key: string; // S3 object key
    url: string; // CloudFront URL
  }
}
```

---

### POST `/upload/episode`

**Description**: Upload an episode video file to S3  
**Authentication**: None  
**Request Type**: `multipart/form-data`  
**Files**:

- `file`: Video file (required)
  - Max size: 500MB
  - Allowed types: mp4, mov, avi, mkv

**Response**:

```typescript
{
  success: true;
  message: 'Episode uploaded successfully';
  data: {
    key: string; // S3 object key (in episodes folder)
    url: string; // CloudFront URL
  }
}
```

---

### POST `/upload/reel`

**Description**: Upload a reel video file to S3  
**Authentication**: None  
**Request Type**: `multipart/form-data`  
**Files**:

- `file`: Video file (required)
  - Max size: 100MB
  - Allowed types: mp4, mov

**Response**:

```typescript
{
  success: true;
  message: 'Reel uploaded successfully';
  data: {
    key: string; // S3 object key (in reels folder)
    url: string; // CloudFront URL
  }
}
```

---

### POST `/upload/image`

**Description**: Upload an image file to S3  
**Authentication**: None  
**Request Type**: `multipart/form-data`  
**Files**:

- `file`: Image file (required)
  - Max size: 10MB
  - Allowed types: jpg, jpeg, png, gif, webp

**Response**:

```typescript
{
  success: true;
  message: 'Image uploaded successfully';
  data: {
    key: string; // S3 object key (in images folder)
    url: string; // CloudFront URL
  }
}
```

---

### POST `/upload/pdf`

**Description**: Upload a PDF file to S3  
**Authentication**: None  
**Request Type**: `multipart/form-data`  
**Files**:

- `file`: PDF file (required)
  - Max size: 20MB
  - Allowed types: pdf

**Response**:

```typescript
{
  success: true;
  message: 'PDF uploaded successfully';
  data: {
    key: string; // S3 object key (in PDF folder)
    url: string; // CloudFront URL
  }
}
```

---

## 9. News Controller (`/news`)

### POST `/news`

**Description**: Create a new news item with thumbnail  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `ADMIN` or `SUPERADMIN`  
**Request Type**: `multipart/form-data`  
**Request Body** (`CreateNewsDto`):

```typescript
{
  title: string; // Required
  projectId: string; // MongoDB ObjectId (required)
  developer: string; // Required
}
```

**Files**:

- `image`: Thumbnail image file (required)

**Response**:

```typescript
{
  _id: string;
  title: string;
  thumbnail: string; // S3 CloudFront URL
  projectId: string; // Populated Project object
  developer: string;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### GET `/news`

**Description**: Get all news items  
**Authentication**: None  
**Request**: None  
**Response**: Array of news objects with populated project references

---

### GET `/news/:id`

**Description**: Get a news item by ID  
**Authentication**: None  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Response**: News object with populated project reference

---

### PATCH `/news/:id`

**Description**: Update a news item  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `ADMIN` or `SUPERADMIN`  
**Request Type**: `multipart/form-data` (optional file)  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Request Body** (`UpdateNewsDto` - all fields optional):

```typescript
{
  title?: string;
  projectId?: string;             // MongoDB ObjectId
  developer?: string;
}
```

**Files**:

- `image`: Thumbnail image file (optional)

**Response**: Updated news object with populated project reference

---

### DELETE `/news/:id`

**Description**: Delete a news item (removes thumbnail from S3)  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `ADMIN` or `SUPERADMIN`  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Response**: Deleted news object

---

## 10. Files Controller (`/files`)

### POST `/files/upload/inventory`

**Description**: Upload an inventory file to S3  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `ADMIN` or `SUPERADMIN`  
**Request Type**: `multipart/form-data`  
**Request Body** (`CreateInventoryDto`):

```typescript
{
  projectId: string; // MongoDB ObjectId (required)
  title: string; // Required
}
```

**Files**:

- `inventory`: Inventory file (required)
  - Supported formats: pdf, xlsx, csv, etc.

**Response**:

```typescript
{
  message: string; // "Inventory uploaded successfully"
  inventory: Inventory; // Created inventory object
}
```

---

### POST `/files/upload/pdf`

**Description**: Upload a PDF file to S3  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `ADMIN` or `SUPERADMIN`  
**Request Type**: `multipart/form-data`  
**Request Body** (`CreatePdfDto`):

```typescript
{
  projectId: string; // MongoDB ObjectId (required)
  title: string; // Required
}
```

**Files**:

- `PDF`: PDF file (required)

**Response**:

```typescript
{
  message: string; // "PDF uploaded successfully"
  pdf: File; // Created PDF object
}
```

---

### GET `/files/inventory`

**Description**: Get all inventory files  
**Authentication**: Required (`AuthGuard`)  
**Required Role**: Any authenticated user  
**Request**: None  
**Response**: Array of inventory objects with populated project references

---

### GET `/files/inventory/:id`

**Description**: Get an inventory file by ID  
**Authentication**: Required (`AuthGuard`)  
**Required Role**: Any authenticated user  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Response**: Inventory object with populated project reference

---

### GET `/files/pdf`

**Description**: Get all PDF files  
**Authentication**: Required (`AuthGuard`)  
**Required Role**: Any authenticated user  
**Request**: None  
**Response**: Array of PDF objects with populated project references

---

### GET `/files/pdf/:id`

**Description**: Get a PDF file by ID  
**Authentication**: Required (`AuthGuard`)  
**Required Role**: Any authenticated user  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Response**: PDF object with populated project reference

---

### PATCH `/files/inventory/:id`

**Description**: Update an inventory file (with optional file replacement)  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `ADMIN` or `SUPERADMIN`  
**Request Type**: `multipart/form-data`  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Request Body** (`UpdateInventoryDto` - all fields optional):

```typescript
{
  title?: string;
}
```

**Files** (optional - if provided, replaces the old file in S3):

- `inventory`: Inventory file (optional) - replaces old inventory file

**Response**:

```typescript
{
  message: string; // "Inventory updated successfully"
  inventory: Inventory; // Updated inventory object with populated project and developer
}
```

**Note**: When a new file is uploaded, the old file is automatically deleted from S3.

---

### PATCH `/files/pdf/:id`

**Description**: Update a PDF file (with optional file replacement)  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `ADMIN` or `SUPERADMIN`  
**Request Type**: `multipart/form-data`  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Request Body** (`UpdatePdfDto` - all fields optional):

```typescript
{
  title?: string;
}
```

**Files** (optional - if provided, replaces the old file in S3):

- `PDF`: PDF file (optional) - replaces old PDF file

**Response**:

```typescript
{
  message: string; // "PDF updated successfully"
  pdf: File; // Updated PDF object with populated project and developer
}
```

**Note**: When a new file is uploaded, the old file is automatically deleted from S3.

---

### DELETE `/files/inventory/:id`

**Description**: Delete an inventory file (removes from S3)  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `ADMIN` or `SUPERADMIN`  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Response**: Deletion confirmation

---

### DELETE `/files/pdf/:id`

**Description**: Delete a PDF file (removes from S3)  
**Authentication**: Required (`AuthGuard`, `RolesGuard`)  
**Required Role**: `ADMIN` or `SUPERADMIN`  
**Route Parameters** (`MongoIdDto`):

```typescript
{
  id: string; // Valid MongoDB ObjectId (required)
}
```

**Response**: Deletion confirmation

---

## 11. Watch History Controller (`/watch-history`)

Tracks user progress for "Continue Watching" and allows resuming playback.

### POST `/watch-history/progress`

**Description**: Create/update watch progress. Automatically calculates `progressPercentage` and marks `completed=true` when progress reaches **90%+**.  
**Authentication**: Required (`JwtAuthGuard`)  
**Request Body** (`UpdateWatchProgressDto`):

```typescript
{
  contentId: string;            // Required (unique per user)
  contentTitle: string;         // Required
  contentThumbnail?: string;    // Optional URL
  currentTime: number;          // Required (seconds, >= 0)
  duration: number;             // Required (seconds, >= 1)
  contentType?: string;         // Optional: 'movie' | 'series' | 'episode'
  season?: number;              // Optional (for series/episodes)
  episode?: number;             // Optional (for series/episodes)
}
```

**Response**:

```typescript
{
  message: string; // "Watch progress updated successfully"
  watchHistory: {
    _id: string;
    userId: string;
    contentId: string;
    contentTitle: string;
    contentThumbnail?: string;
    currentTime: number;
    duration: number;
    progressPercentage: number; // 0-100
    completed: boolean;         // true if progress >= 90
    lastWatchedAt: Date;
    contentType?: string;
    season?: number;
    episode?: number;
    createdAt: Date;
    updatedAt: Date;
  };
}
```

---

### GET `/watch-history/continue-watching?limit=10`

**Description**: Returns incomplete content with progress (`0 < progress < 90`), sorted by most recently watched.  
**Authentication**: Required (`JwtAuthGuard`)  
**Query Parameters**:

- `limit` (optional): default `10` (max 100)

**Response**:

```typescript
{
  message: string; // "Continue watching list fetched successfully"
  items: WatchHistory[];
  count: number;
}
```

---

### GET `/watch-history?includeCompleted=true&limit=50`

**Description**: Returns watch history.  
**Authentication**: Required (`JwtAuthGuard`)  
**Query Parameters**:

- `includeCompleted` (optional): default `true`
- `limit` (optional): default `50` (max 200)

**Response**:

```typescript
{
  message: string; // "Watch history fetched successfully"
  items: WatchHistory[];
  count: number;
}
```

---

### GET `/watch-history/recent?limit=10`

**Description**: Returns content watched in the last 24 hours.  
**Authentication**: Required (`JwtAuthGuard`)  
**Query Parameters**:

- `limit` (optional): default `10` (max 100)

**Response**:

```typescript
{
  message: string; // "Recently watched content fetched successfully"
  items: WatchHistory[];
  count: number;
}
```

---

### GET `/watch-history/content/:contentId`

**Description**: Returns watch progress for a specific content.  
**Authentication**: Required (`JwtAuthGuard`)

**Response**:

```typescript
{
  message: string; // "Watch progress fetched successfully"
  watchHistory: WatchHistory | null;
}
```

---

### POST `/watch-history/content/:contentId/complete`

**Description**: Manually mark content as completed (`progressPercentage=100`).  
**Authentication**: Required (`JwtAuthGuard`)

**Response**:

```typescript
{
  message: string; // "Content marked as completed"
  watchHistory: WatchHistory;
}
```

---

### DELETE `/watch-history/content/:contentId`

**Description**: Remove a specific content from watch history.  
**Authentication**: Required (`JwtAuthGuard`)

**Response**:

```typescript
{
  message: string; // "Content removed from watch history"
}
```

---

### DELETE `/watch-history/clear`

**Description**: Clear all watch history for the current user.  
**Authentication**: Required (`JwtAuthGuard`)

**Response**:

```typescript
{
  message: string; // "Watch history cleared successfully"
}
```

---

## Response Entities

### User Entity

```typescript
{
  _id: string;
  username: string;
  email: string;
  password: string;                    // Excluded from responses
  phoneNumber: string;
  savedProjects: string[];             // Array of Project ObjectIds
  savedReels: string[];                // Array of Reel ObjectIds
  role: 'user' | 'admin' | 'developer' | 'superadmin';
  isEmailVerified: boolean;            // Email verification status
  emailVerificationOTP?: string;       // Excluded from responses
  emailVerificationOTPExpires?: Date;  // Excluded from responses
  passwordResetOTP?: string;           // Excluded from responses
  passwordResetOTPExpires?: Date;      // Excluded from responses
  createdAt: Date;
  updatedAt: Date;
}
```

### Project Entity

```typescript
{
  _id: string;
  title: string;
  slug: string;
  logoUrl?: string;
  location: string;
  status: 'PLANNING' | 'CONSTRUCTION' | 'COMPLETED' | 'DELIVERED';
  developer: string | Developer;  // ObjectId or populated Developer
  script: string;
  episodes: string[] | Episode[];  // Array of ObjectIds or populated Episodes
  reels: string[] | Reel[];        // Array of ObjectIds or populated Reels
  inventory?: string | Inventory;   // ObjectId or populated Inventory (single)
  pdf: string[] | File[];           // Array of ObjectIds or populated Files
  heroVideoUrl: string;
  whatsappNumber?: string;
  trendingScore: number;
  saveCount: number;
  viewCount: number;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Developer Entity

```typescript
{
  _id: string;
  name: string;
  logo: string;
  email?: string;
  phone: string;
  location: string;
  projects: string[] | Project[];  // Array of ObjectIds or populated Projects
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Episode Entity

```typescript
{
  _id: string;
  projectId: string | Project;  // ObjectId or populated Project
  title: string;
  thumbnail?: string;
  episodeUrl: string;
  episodeOrder: string;
  duration?: string;
  s3Key: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Reel Entity

```typescript
{
  _id: string;
  title: string;
  description?: string;
  videoUrl: string;          // S3 URL to video
  thumbnail: string;         // S3 URL to thumbnail
  projectId?: string | Project;  // ObjectId or populated Project
  s3VideoKey: string;        // S3 key for video
  s3ThumbnailKey: string;    // S3 key for thumbnail
  savedBy?: string[];        // Array of User ObjectIds
  createdAt: Date;
  updatedAt: Date;
}
```

### News Entity

```typescript
{
  _id: string;
  title: string;
  thumbnail: string; // S3 CloudFront URL
  projectId: string | Project; // ObjectId or populated Project
  developer: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Inventory Entity

```typescript
{
  _id: string;
  projectId: string | Project;   // ObjectId or populated Project
  fileUrl: string;               // S3 CloudFront URL
  fileName: string;
  s3Key: string;                 // S3 object key
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### File Entity (PDF)

```typescript
{
  _id: string;
  projectId: string | Project; // ObjectId or populated Project
  fileUrl: string; // S3 CloudFront URL
  fileName: string;
  title: string;
  s3Key: string; // S3 object key
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Authentication

Most routes require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

The token is obtained from `/auth/login` or `/auth/register` endpoints.

---

## Error Responses

All endpoints may return standard HTTP error responses:

- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Insufficient permissions (role-based)
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict (e.g., user already exists)
- `500 Internal Server Error`: Server error

---

## Notes

1. All MongoDB ObjectIds must be valid 24-character hexadecimal strings
2. File uploads use `multipart/form-data` content type
3. Query parameters and route parameters are automatically validated
4. Dates are returned in ISO 8601 format
5. Pagination defaults: `limit=10`, `page=1`
6. Some routes marked as "TODO" are not yet fully implemented
