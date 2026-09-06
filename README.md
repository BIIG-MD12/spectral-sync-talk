# FluidTalk Chat

🏗️ The Full-Stack FluidTalk Master Prompt

Act as a Principal Full-Stack Engineer and Product Architect. Build "FluidTalk," a premium, dark-mode chat application with an iMessage-inspired futuristic aesthetic.

CRITICAL ARCHITECTURAL CONSTRAINTS:

1.

NO SUPABASE. Do not install or import  @supabase/supabase-js .

2.

CUSTOM BACKEND INTEGRATION: All data operations MUST go through a centralized API service at  src/lib/api.ts  using native  fetch . Base URL comes from  import.meta.env.VITE_API_URL .

3.

REAL-TIME ENGINE: Create a custom hook at  src/hooks/useRealtime.ts  using  socket.io-client . Manage connection state, reconnection logic, and room joining/leaving within this hook.

4.

STATE MANAGEMENT: Use Zustand for global state (auth user, active conversation, unread counts, socket connection status).

5.

ANIMATION ENGINE: Use Framer Motion for ALL animations. No CSS transitions. Use spring physics ( type: "spring", stiffness: 300, damping: 25 ) for message bubbles, tab switches, and menu expansions.

BACKEND API CONTRACT (MOCK & STRUCTURE):

Since we are connecting to a custom Node.js/Express + Neon PostgreSQL backend, structure all API calls to match these exact endpoints. Create mock handlers in  api.ts  for development, but ensure the function signatures match this contract:

 POST /api/auth/email-otp :  { email }  →  { token, requiresOtp } 

 POST /api/auth/verify-otp :  { email, otp }  →  { user, jwt } 

 POST /api/auth/google :  { idToken }  →  { user, jwt } 

 GET /api/conversations : →  Conversation[]  (joined with last message & unread count)

 GET /api/conversations/:id/messages?cursor=&limit= : →  { messages, nextCursor }  (paginated)

 POST /api/conversations/:id/messages :  { content, effect_type?, reply_to_id?, scheduled_at? }  →  Message 

 POST /api/contact-requests :  { receiver_id }  →  ContactRequest 

 PUT /api/contact-requests/:id :  { status: 'accepted' | 'rejected' }  →  ContactRequest 

DATABASE SCHEMA ALIGNMENT:

Ensure all TypeScript interfaces in  src/types/index.ts  strictly match our Neon PostgreSQL schema:

 Profile :  id, email, username, display_name, avatar_url, status, created_at 

 Conversation :  id, title, is_group, created_at 

 Participant :  conversation_id, user_id, joined_at 

 Message :  id, conversation_id, sender_id, content, effect_type ('none'|'invisible_ink'|'slam'|'loud'|'gentle'), scheduled_at, sent_at, created_at 

 ContactRequest :  id, sender_id, receiver_id, status ('pending'|'accepted'|'rejected'), created_at 

DESIGN SYSTEM (iMessage Magic):

Palette: Deep midnight black ( #0a0a0f ), glass surfaces ( rgba(255,255,255,0.08)  +  backdrop-filter: blur(20px) ), glowing cyan accent ( #00e5ff ).

Typography: Inter font. Message text 16px, metadata 12px muted.

Input Bar: Floating pill shape, expands vertically on multi-line input. Dedicated camera icon (no hidden "+" menu). Morphing send button.

Message Bubbles: Sent = gradient cyan-to-purple with subtle inner glow. Received = dark glass. Both have rounded corners (18px top, 4px bottom for sent; reversed for received).

CORE FEATURES TO BUILD FIRST:

1.

Auth Screen: Email OTP + Google Sign-in UI. Animated particle background. Zero-friction flow.

2.

Chat List: Glassmorphic cards showing last message preview, timestamp, and unread badge. Swipe-to-archive gesture.

3.

Chat Room:

Messages load with staggered spring animation.

Mystery Reveal Effect: If message has  effect_type === 'invisible_ink' , render a shimmering particle overlay. Implement a drag/swipe gesture handler that reduces overlay opacity based on finger movement, revealing content underneath.

Double-tap to react (show floating emoji picker attached to bubble).

Inline reply thread preview above replied-to messages.

4.

Send Later UI: Scheduled messages appear as translucent "Time Capsule" bubbles with clock icon, visually distinct from live messages.

DELIVERABLES:

Start by generating the complete project structure,  api.ts  with mock handlers matching the backend contract,  useRealtime.ts , Zustand store, Auth screen, and Chat Room screen with Mystery Reveal interaction. Ensure all components are fully typed with TypeScript interfaces matching our Neon DB schema.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://spectral-sync-talk.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/484a72eb-4b90-4800-934a-e9660118c8fe).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
