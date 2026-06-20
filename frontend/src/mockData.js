export const MOCK_MEETINGS = [
  {
    id: "mock-1",
    title: "Q3 Strategic Alignment Sync",
    date: "June 14, 2026",
    duration: "42 min",
    type: "Audio Upload",
    summary: "The executive team reviewed Q2 deliverables and finalized priorities for Q3. The primary initiatives include migrating the primary database cluster to Aurora Multi-AZ to resolve recent latency issues, finalizing the feature scope for the new Customer Portal beta, and developing the Enterprise sales playbook to launch sales training. The team agreed on a temporary freeze for new feature requests during the first three weeks of Q3 to prioritize platform stability.",
    action_items: [
      {
        owner: "David Chen (Engineering)",
        task: "Migrate Postgres production cluster to Aurora Multi-AZ and perform latency testing",
        deadline: "July 10, 2026"
      },
      {
        owner: "Sarah Jenkins (Product)",
        task: "Finalize beta feature scope for Customer Portal and deliver detailed UI/UX wireframes",
        deadline: "June 25, 2026"
      },
      {
        owner: "Marcus Aurelius (Sales)",
        task: "Develop the new Enterprise segment sales playbook and coordinate sales training dates",
        deadline: "July 20, 2026"
      }
    ],
    draft_emails: [
      {
        to: "David Chen (Engineering)",
        subject: "Action Required: Postgres Cluster Migration (Aurora Multi-AZ)",
        body: "Hi David,\n\nFollowing up on our Q3 strategic alignment sync, you are assigned to lead the migration of the database cluster to Aurora Multi-AZ. The goal is to stabilize read/write queries and optimize overall service response times.\n\nTarget Completion: July 10, 2026.\n\nPlease keep the DevOps channel updated on your progress.\n\nBest regards,\nOperations Team"
      },
      {
        to: "Sarah Jenkins (Product)",
        subject: "Action Required: Customer Portal Wireframes & Scope",
        body: "Hi Sarah,\n\nGreat work aligning the portal goals today. Please compile the beta scope document and complete the UI/UX wireframes for frontend development. \n\nTarget Completion: June 25, 2026.\n\nThanks,\nOperations Team"
      },
      {
        to: "Marcus Aurelius (Sales)",
        subject: "Action Required: Enterprise Playbook & Sales Training",
        body: "Hi Marcus,\n\nAs discussed, please draft the sales playbook for our new enterprise packages and coordinate training dates with regional sales managers.\n\nTarget Completion: July 20, 2026.\n\nBest,\nOperations Team"
      }
    ],
    transcript: "David: Hello team, let's kick off the Q3 strategic alignment. Sarah, do you have updates on the portal?\nSarah: Yes, we are on track to define the beta scope. I'll need until the 25th to deliver the final wireframes.\nDavid: Perfect. On engineering, I'll handle the postgres migration myself by July 10 to ensure we have a robust database backing the portal.\nMarcus: What about sales? I will prepare the Enterprise playbook and kick off training sessions by July 20."
  },
  {
    id: "mock-2",
    title: "SaaS Platform Launch Retrospective",
    date: "June 10, 2026",
    duration: "28 min",
    type: "Text Paste",
    summary: "A post-mortem analysis of the SaaS Platform launch. Overall, the release was highly successful, registering over 5,000 new signups in 48 hours. However, high database query latency on billing and account endpoints was reported during peak traffic. The marketing team noted high conversion rates from campaigns, but identified a 25% drop-off in step 2 of the onboarding flow, prompting a request for interactive helper tooltips.",
    action_items: [
      {
        owner: "Alex Rivera (DevOps)",
        task: "Configure Redis caching layer for the billing and account query endpoints",
        deadline: "June 18, 2026"
      },
      {
        owner: "Clara Vance (Marketing)",
        task: "Analyze telemetric data on the step 2 onboarding funnel drop-offs and compile a report",
        deadline: "June 22, 2026"
      },
      {
        owner: "Julian Vance (Frontend)",
        task: "Build and integrate multi-step onboarding tooltips to improve new user conversion",
        deadline: "June 30, 2026"
      }
    ],
    draft_emails: [
      {
        to: "Alex Rivera (DevOps)",
        subject: "Launch Retro Action Item: Redis Caching Configuration",
        body: "Hi Alex,\n\nTo address the API bottlenecks observed during launch, please deploy and configure the Redis caching layer for the /billing and /accounts queries.\n\nTarget Completion: June 18, 2026.\n\nBest,\nPlatform Team"
      },
      {
        to: "Clara Vance (Marketing)",
        subject: "Action Required: Onboarding Drop-off Analytics Report",
        body: "Hi Clara,\n\nPlease review our post-launch telemetry on Mixpanel to draft a detailed report on the user onboarding drop-off points.\n\nTarget Completion: June 22, 2026.\n\nThanks,\nPlatform Team"
      },
      {
        to: "Julian Vance (Frontend)",
        subject: "Action Required: Multi-step Onboarding Tooltips",
        body: "Hi Julian,\n\nBased on Clara's upcoming report on drop-offs, please build and deploy user onboarding tooltips to guide new registrations.\n\nTarget Completion: June 30, 2026.\n\nBest,\nPlatform Team"
      }
    ],
    transcript: "Alex: We saw some high latency on /billing and /accounts when signups spiked.\nJulian: I think caching those queries would help a lot. Alex, can you take a look?\nAlex: Yes, I can configure a Redis cache for those by June 18.\nClara: Also, our analytics show a 25% drop-off on the second step of the onboarding wizard. I will compile a report by June 22.\nJulian: Once we have that, I can build some interactive tooltips to keep users engaged. I'll have it ready by the end of the month."
  }
];
