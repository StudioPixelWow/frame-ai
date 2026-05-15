---
name: postiz
description: >
  Postiz open-source social media scheduling and management platform integration guide.
  Covers what Postiz is, API integration patterns, multi-platform scheduling, content queue
  management, analytics integration, team collaboration, webhook integration, and how to
  integrate the Postiz API into a Next.js SaaS platform (like PixelManageAI).
  Use when building or extending social media management features powered by Postiz.
---

# Postiz Integration Guide — PixelManageAI

## Use When...

- Building social media scheduling features into PixelManageAI
- Connecting a client's social accounts (Instagram, Facebook, LinkedIn, TikTok, Twitter/X)
- Setting up automated posting pipelines from PixelManageAI workflows
- Implementing content queue management UI
- Pulling analytics from social platforms via Postiz
- Setting up team collaboration on content approval

---

## 1. What is Postiz?

Postiz is an open-source social media scheduling and management platform (MIT license). It serves as a self-hostable alternative to Buffer, Hootsuite, or Later.

```
Key characteristics:
  - Open-source: https://github.com/gitroomhq/postiz-app
  - Self-hostable: Run on your own infrastructure (full data ownership)
  - API-first: REST API for programmatic integration
  - Multi-platform: Supports all major social platforms
  - Team features: Roles, approval workflows, comments on posts
  - Analytics: Engagement metrics per post and per channel
  - AI integration: Built-in AI writing assistant

Supported platforms (as of 2025):
  - Instagram (Business accounts via Meta API)
  - Facebook (Pages via Meta API)
  - Twitter / X
  - LinkedIn (Personal + Company pages)
  - TikTok
  - YouTube
  - Pinterest
  - Reddit
  - Threads
  - Bluesky
  - Mastodon (self-hosted instances)
  - Telegram channels
  - Discord
  - Slack (team channels)
  - Google Business Profile (via integration)

Tech stack:
  - Frontend: Next.js
  - Backend: NestJS
  - Database: PostgreSQL
  - Queue: Redis (BullMQ)
  - Storage: S3-compatible
  - Auth: NextAuth.js
```

---

## 2. Self-Hosting Postiz for PixelManageAI

### 2.1 Docker Compose Setup

```yaml
# docker-compose.yml for Postiz + PixelManageAI infrastructure
version: '3.8'

services:
  postiz:
    image: ghcr.io/gitroomhq/postiz-app:latest
    container_name: postiz
    restart: always
    environment:
      MAIN_URL: "https://postiz.yourdomain.com"
      FRONTEND_URL: "https://postiz.yourdomain.com"
      NEXT_PUBLIC_BACKEND_URL: "https://postiz.yourdomain.com/api"
      JWT_SECRET: "${POSTIZ_JWT_SECRET}"
      DATABASE_URL: "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/postiz"
      REDIS_URL: "redis://redis:6379"
      BACKEND_INTERNAL_URL: "http://localhost:3000"
      IS_GENERAL: "true"  # Multi-tenant mode
      # Storage (use S3 or compatible like Cloudflare R2)
      CLOUDFLARE_ACCOUNT_ID: "${CF_ACCOUNT_ID}"
      CLOUDFLARE_ACCESS_KEY: "${CF_ACCESS_KEY}"
      CLOUDFLARE_SECRET_ACCESS_KEY: "${CF_SECRET_KEY}"
      CLOUDFLARE_BUCKETNAME: "${CF_BUCKET_NAME}"
      CLOUDFLARE_BUCKET_URL: "${CF_BUCKET_URL}"
      # Social OAuth credentials
      FACEBOOK_APP_ID: "${FB_APP_ID}"
      FACEBOOK_APP_SECRET: "${FB_APP_SECRET}"
      LINKEDIN_CLIENT_ID: "${LI_CLIENT_ID}"
      LINKEDIN_CLIENT_SECRET: "${LI_CLIENT_SECRET}"
      TIKTOK_CLIENT_KEY: "${TIKTOK_CLIENT_KEY}"
      TIKTOK_CLIENT_SECRET: "${TIKTOK_CLIENT_SECRET}"
      TWITTER_API_KEY: "${TWITTER_API_KEY}"
      TWITTER_API_SECRET: "${TWITTER_API_SECRET}"
    ports:
      - "5000:5000"
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: postiz
      POSTGRES_USER: "${POSTGRES_USER}"
      POSTGRES_PASSWORD: "${POSTGRES_PASSWORD}"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### 2.2 Environment Variables Checklist

```bash
# Required for PixelManageAI → Postiz integration
POSTIZ_BASE_URL=https://postiz.yourdomain.com
POSTIZ_API_KEY=your-api-key-here   # Generated in Postiz admin
POSTIZ_ORG_ID=your-org-id          # Organization ID from Postiz

# Social platform OAuth apps (register your app on each platform)
# Meta: developers.facebook.com
# LinkedIn: linkedin.com/developers
# TikTok: developers.tiktok.com
# Twitter: developer.twitter.com
```

---

## 3. Postiz REST API Integration

### 3.1 Authentication

```typescript
// lib/postiz/client.ts
import axios from 'axios';

const postizClient = axios.create({
  baseURL: process.env.POSTIZ_BASE_URL + '/api',
  headers: {
    'Authorization': `Bearer ${process.env.POSTIZ_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

export default postizClient;
```

### 3.2 Core API Endpoints

```typescript
// Types for Postiz API
interface PostizPost {
  id: string;
  content: string;
  media?: string[];          // Array of media URLs
  platforms: PostizPlatform[];
  scheduledAt: string;       // ISO 8601
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED' | 'CANCELED';
  tags?: string[];
  organizationId: string;
}

interface PostizPlatform {
  integrationId: string;     // ID of the connected social account
  content?: string;          // Platform-specific override
  media?: string[];          // Platform-specific media
  settings?: {
    reels?: boolean;         // Instagram: post as Reel
    story?: boolean;         // Instagram: post as Story
    carousel?: boolean;      // LinkedIn carousel
  };
}

// Create a scheduled post
async function createPost(params: {
  organizationId: string;
  content: string;
  platforms: PostizPlatform[];
  scheduledAt: Date;
  media?: string[];
}): Promise<PostizPost> {
  const response = await postizClient.post('/posts', {
    organization_id: params.organizationId,
    content: params.content,
    date: params.scheduledAt.toISOString(),
    platforms: params.platforms,
    media: params.media || [],
  });
  return response.data;
}

// Get all posts for an organization
async function getPosts(params: {
  organizationId: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{ posts: PostizPost[]; total: number }> {
  const response = await postizClient.get('/posts', {
    params: {
      organization_id: params.organizationId,
      status: params.status,
      page: params.page || 1,
      limit: params.limit || 20,
    },
  });
  return response.data;
}

// Update a scheduled post (before publishing)
async function updatePost(
  postId: string,
  updates: Partial<PostizPost>
): Promise<PostizPost> {
  const response = await postizClient.put(`/posts/${postId}`, updates);
  return response.data;
}

// Delete/cancel a scheduled post
async function cancelPost(postId: string): Promise<void> {
  await postizClient.delete(`/posts/${postId}`);
}

// Get integrations (connected social accounts)
async function getIntegrations(
  organizationId: string
): Promise<PostizIntegration[]> {
  const response = await postizClient.get('/integrations', {
    params: { organization_id: organizationId },
  });
  return response.data;
}
```

### 3.3 Media Upload

```typescript
// Upload media to Postiz (S3-backed storage)
async function uploadMedia(
  file: File | Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const formData = new FormData();
  formData.append('file', new Blob([file], { type: mimeType }), filename);
  
  const response = await postizClient.post('/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  
  return response.data.url;  // Returns CDN URL of uploaded media
}

// Usage in PixelManageAI post creation flow
async function createPostWithMedia(
  content: string,
  imageFile: File,
  platforms: string[],
  scheduledAt: Date,
  clientOrgId: string
): Promise<PostizPost> {
  // 1. Upload media first
  const mediaUrl = await uploadMedia(imageFile, imageFile.name, imageFile.type);
  
  // 2. Get connected integrations for client
  const integrations = await getIntegrations(clientOrgId);
  const selectedIntegrations = integrations
    .filter(i => platforms.includes(i.platform))
    .map(i => ({ integrationId: i.id }));
  
  // 3. Create scheduled post
  return createPost({
    organizationId: clientOrgId,
    content,
    platforms: selectedIntegrations,
    scheduledAt,
    media: [mediaUrl],
  });
}
```

---

## 4. Multi-Platform Scheduling from PixelManageAI

### 4.1 Platform-Specific Content Adaptation

```typescript
// Adapt a single content brief to platform-specific posts
interface ContentBrief {
  mainContent: string;       // Core message (Hebrew)
  hashtags: string[];        // Hebrew + English hashtags
  mediaUrl?: string;
  cta?: string;
  client: PixelManageAIClient;
}

function adaptContentForPlatforms(brief: ContentBrief): PostizPlatform[] {
  const platforms: PostizPlatform[] = [];
  
  // Instagram: full hashtags, emoji-friendly, Reels option
  if (brief.client.activeChannels.includes('instagram')) {
    platforms.push({
      integrationId: brief.client.postizIntegrations.instagram,
      content: `${brief.mainContent}\n\n${brief.hashtags.map(h => `#${h}`).join(' ')}`,
      settings: { reels: brief.mediaUrl?.endsWith('.mp4') },
    });
  }
  
  // LinkedIn: fewer hashtags, more professional tone, no emoji excess
  if (brief.client.activeChannels.includes('linkedin')) {
    platforms.push({
      integrationId: brief.client.postizIntegrations.linkedin,
      content: `${brief.mainContent}\n\n${brief.hashtags.slice(0, 3).map(h => `#${h}`).join(' ')}`,
    });
  }
  
  // Facebook: similar to Instagram but can be longer
  if (brief.client.activeChannels.includes('facebook')) {
    platforms.push({
      integrationId: brief.client.postizIntegrations.facebook,
      content: brief.mainContent,
    });
  }
  
  // TikTok: shorter caption, max 5 hashtags
  if (brief.client.activeChannels.includes('tiktok')) {
    platforms.push({
      integrationId: brief.client.postizIntegrations.tiktok,
      content: `${brief.mainContent.slice(0, 150)} ${brief.hashtags.slice(0, 5).map(h => `#${h}`).join(' ')}`,
    });
  }
  
  return platforms;
}
```

### 4.2 Content Queue Management

```typescript
// Content queue for a client
interface ContentQueue {
  clientId: string;
  posts: QueuedPost[];
  postingSchedule: PostingSchedule;
}

interface QueuedPost {
  id: string;
  content: ContentBrief;
  status: 'draft' | 'pending_approval' | 'approved' | 'scheduled' | 'published';
  scheduledAt?: Date;
  postizPostId?: string;
  approvedBy?: string;
  approvedAt?: Date;
  feedback?: string;
}

interface PostingSchedule {
  instagram: TimeSlot[];     // e.g., [{ day: 0, hour: 7, minute: 30 }] (0=Sunday)
  facebook: TimeSlot[];
  linkedin: TimeSlot[];
  tiktok: TimeSlot[];
}

// Auto-fill queue with next available time slots (Israeli calendar aware)
function getNextAvailableSlot(
  platform: string,
  schedule: PostingSchedule,
  after: Date
): Date {
  // Skip Friday afternoon and Shabbat
  // Skip Israeli holidays
  // Return next slot from schedule
  const slots = schedule[platform];
  // ... implementation
}
```

---

## 5. Approval Workflow Integration

### 5.1 PixelManageAI → Postiz Approval Flow

```typescript
// Multi-step approval workflow
enum ApprovalStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  AGENCY_APPROVED = 'AGENCY_APPROVED',
  CLIENT_APPROVED = 'CLIENT_APPROVED',
  REJECTED = 'REJECTED',
  SCHEDULED = 'SCHEDULED',
}

async function submitForApproval(
  postId: string,
  submittedBy: string
): Promise<void> {
  await updateQueuedPost(postId, {
    status: ApprovalStatus.SUBMITTED,
    submittedBy,
    submittedAt: new Date(),
  });
  
  // Notify agency reviewer via WhatsApp/email
  await sendApprovalNotification({
    type: 'agency_review',
    postId,
    message: `פוסט חדש ממתין לאישור: ${process.env.APP_URL}/posts/${postId}`,
  });
}

async function approveAndSchedule(
  postId: string,
  approvedBy: string,
  approverType: 'agency' | 'client'
): Promise<void> {
  const post = await getQueuedPost(postId);
  
  // Two-step approval: agency first, then client (optional)
  if (approverType === 'agency') {
    await updateQueuedPost(postId, { status: ApprovalStatus.AGENCY_APPROVED });
    // Notify client for final approval if required
    return;
  }
  
  // Final approval — schedule in Postiz
  const postizPost = await createPost({
    organizationId: post.client.postizOrgId,
    content: post.content.mainContent,
    platforms: adaptContentForPlatforms(post.content),
    scheduledAt: post.scheduledAt,
    media: post.content.mediaUrl ? [post.content.mediaUrl] : [],
  });
  
  await updateQueuedPost(postId, {
    status: ApprovalStatus.SCHEDULED,
    postizPostId: postizPost.id,
    approvedBy,
    approvedAt: new Date(),
  });
}
```

---

## 6. Analytics Integration

### 6.1 Pulling Performance Data from Postiz

```typescript
// Get post analytics
async function getPostAnalytics(
  postizPostId: string
): Promise<PostAnalytics> {
  const response = await postizClient.get(`/posts/${postizPostId}/analytics`);
  return response.data;
}

interface PostAnalytics {
  postId: string;
  platform: string;
  publishedAt: string;
  metrics: {
    reach: number;
    impressions: number;
    likes: number;
    comments: number;
    shares: number;
    clicks: number;
    saves?: number;          // Instagram
    profileVisits?: number;
    websiteClicks?: number;
  };
  engagementRate: number;    // Calculated: (likes+comments+shares)/reach
}

// Aggregate analytics for client dashboard
async function getClientSocialReport(
  clientId: string,
  dateRange: { from: Date; to: Date }
): Promise<ClientSocialReport> {
  const posts = await getPostsByClient(clientId, dateRange);
  const analyticsPromises = posts
    .filter(p => p.postizPostId && p.status === 'published')
    .map(p => getPostAnalytics(p.postizPostId));
  
  const analytics = await Promise.all(analyticsPromises);
  
  return {
    clientId,
    dateRange,
    totalPosts: posts.length,
    totalReach: analytics.reduce((sum, a) => sum + a.metrics.reach, 0),
    totalEngagements: analytics.reduce((sum, a) => 
      sum + a.metrics.likes + a.metrics.comments + a.metrics.shares, 0),
    avgEngagementRate: analytics.reduce((sum, a) => sum + a.engagementRate, 0) / analytics.length,
    topPosts: analytics.sort((a, b) => b.engagementRate - a.engagementRate).slice(0, 5),
    byPlatform: groupByPlatform(analytics),
  };
}
```

---

## 7. Webhook Integration for Automated Posting

### 7.1 Postiz Outbound Webhooks

```typescript
// Postiz sends webhooks for post status changes
// Register webhook endpoint in Postiz settings

// app/api/webhooks/postiz/route.ts (Next.js App Router)
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-postiz-signature');
  
  // Verify webhook signature
  const expectedSig = crypto
    .createHmac('sha256', process.env.POSTIZ_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex');
  
  if (signature !== `sha256=${expectedSig}`) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  
  const event = JSON.parse(body);
  
  switch (event.type) {
    case 'post.published':
      await handlePostPublished(event.data);
      break;
    case 'post.failed':
      await handlePostFailed(event.data);
      break;
    case 'post.scheduled':
      await handlePostScheduled(event.data);
      break;
  }
  
  return NextResponse.json({ received: true });
}

async function handlePostPublished(data: { postId: string; platform: string }) {
  // Update PixelManageAI database
  await updateQueuedPostByPostizId(data.postId, {
    status: 'published',
    publishedAt: new Date(),
  });
  
  // Notify client via WhatsApp (optional)
  const post = await getQueuedPostByPostizId(data.postId);
  if (post.client.notifyOnPublish) {
    await sendWhatsAppMessage(
      post.client.ownerPhone,
      `הפוסט פורסם בהצלחה ב-${data.platform}! 🎉`
    );
  }
}

async function handlePostFailed(data: { postId: string; error: string }) {
  // Alert agency immediately
  await createIncidentAlert({
    type: 'post_publish_failed',
    postizPostId: data.postId,
    error: data.error,
    priority: 'high',
  });
}
```

---

## 8. PixelManageAI Full Integration Architecture

```typescript
// Client onboarding: connect social accounts via Postiz OAuth
async function onboardClientSocialAccounts(
  clientId: string
): Promise<string> {
  // Generate Postiz organization for client
  const org = await postizClient.post('/organizations', {
    name: `Client-${clientId}`,
  });
  
  // Store org ID in client record
  await updateClient(clientId, { postizOrgId: org.data.id });
  
  // Return OAuth connection URL for client to authorize accounts
  return `${process.env.POSTIZ_BASE_URL}/auth/connect?org=${org.data.id}&redirect=${process.env.APP_URL}/clients/${clientId}/social-setup`;
}

// Main scheduler service
class PixelManageAISocialScheduler {
  async scheduleWeeklyPosts(
    clientId: string,
    contentBriefs: ContentBrief[]
  ): Promise<void> {
    const client = await getClient(clientId);
    const schedule = client.postingSchedule;
    
    for (const brief of contentBriefs) {
      const platforms = adaptContentForPlatforms(brief);
      const scheduledAt = getNextAvailableSlot('all', schedule, new Date());
      
      // Create in Postiz
      const postizPost = await createPost({
        organizationId: client.postizOrgId,
        content: brief.mainContent,
        platforms,
        scheduledAt,
        media: brief.mediaUrl ? [await uploadMedia(brief.mediaUrl)] : [],
      });
      
      // Store in PixelManageAI queue
      await createQueuedPost({
        clientId,
        content: brief,
        postizPostId: postizPost.id,
        scheduledAt,
        status: 'scheduled',
      });
    }
  }
}
```
