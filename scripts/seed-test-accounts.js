const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gbvdkzgthqmfoajfpwxq.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdidmRremd0aHFtZm9hamZwd3hxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5Mjc0MzYxOCwiZXhwIjoyMTA4MzE5NjE4fQ.YzT2WDvxfmc_mm8Lhd3Qx1ZNwS-u_zuZ9Ulg9AV6AQU";

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  console.log("Connecting to Supabase at:", supabaseUrl);

  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  // 1. ACCOUNT 1: UPCOMING RENEWALS (Expiring in 7 days)
  const email1 = "renewals@test.com";
  const pass1 = "Password123!";
  const expiresAt1 = new Date(now.getTime() + 7 * dayMs).toISOString();
  const startedAt1 = new Date(now.getTime() - 358 * dayMs).toISOString();

  console.log(`\nCreating Account 1 (${email1}) -> Upcoming Renewals (expires in 7 days)...`);
  
  // Create or get user
  let user1;
  const { data: created1, error: err1 } = await supabase.auth.admin.createUser({
    email: email1,
    password: pass1,
    email_confirm: true,
    user_metadata: { full_name: "Vikram Sharma" },
  });

  if (err1) {
    if (err1.message.includes("already registered")) {
      console.log("User 1 already exists in auth.users, looking up id...");
      const { data: usersData } = await supabase.auth.admin.listUsers();
      user1 = usersData.users.find((u) => u.email === email1);
    } else {
      throw err1;
    }
  } else {
    user1 = created1.user;
  }

  if (!user1) throw new Error("Could not find or create User 1");
  console.log("User 1 ID:", user1.id);

  // Update profile for Account 1
  const { error: profErr1 } = await supabase.from("profiles").upsert({
    id: user1.id,
    email: email1,
    owner_name: "Vikram Sharma",
    business_name: "Apex Horizon Tech",
    job_title: "Managing Director",
    phone: "+91 98765 43210",
    username: "apexhorizon",
    slug: "apexhorizon",
    is_member: true,
    subscription_plan: "pro",
    status: "active",
    primary_card_count: 1,
    purchased_id_count: 3,
    subscription_started_at: startedAt1,
    membership_expires_at: expiresAt1,
    follow_up_status: "unattended",
    follow_up_notes: "Annual renewal due in 7 days. Need to confirm team card quantities.",
    bio: "Apex Horizon delivers modern cloud architecture and enterprise software solutions.",
    updated_at: new Date().toISOString(),
  });
  if (profErr1) console.error("Profile 1 error:", profErr1);
  else console.log("Profile 1 updated successfully (Apex Horizon Tech).");

  // Ensure card exists
  await supabase.from("cards").upsert({
    profile_id: user1.id,
    public_slug: "apexhorizon",
    is_active: true,
  });

  // Add 2 team members
  await supabase.from("employees").upsert([
    {
      owner_id: user1.id,
      name: "Priya Nair",
      designation: "Lead Solutions Architect",
      email: "priya@apexhorizon.in",
      phone: "+91 98765 43211",
      slug: "priya-nair",
      is_active: true,
      is_premium: true,
      subscription_started_at: startedAt1,
      subscription_expires_at: expiresAt1,
      status: "active",
    },
    {
      owner_id: user1.id,
      name: "Karthik Raj",
      designation: "Senior Product Designer",
      email: "karthik@apexhorizon.in",
      phone: "+91 98765 43212",
      slug: "karthik-raj",
      is_active: true,
      is_premium: true,
      subscription_started_at: startedAt1,
      subscription_expires_at: expiresAt1,
      status: "active",
    },
  ]);
  console.log("Added 2 team members for Apex Horizon.");


  // 2. ACCOUNT 2: EXPIRED (Expired 5 days ago)
  const email2 = "expired@test.com";
  const pass2 = "Password123!";
  const expiresAt2 = new Date(now.getTime() - 5 * dayMs).toISOString();
  const startedAt2 = new Date(now.getTime() - 370 * dayMs).toISOString();

  console.log(`\nCreating Account 2 (${email2}) -> Expired (expired 5 days ago)...`);

  let user2;
  const { data: created2, error: err2 } = await supabase.auth.admin.createUser({
    email: email2,
    password: pass2,
    email_confirm: true,
    user_metadata: { full_name: "Rohan Verma" },
  });

  if (err2) {
    if (err2.message.includes("already registered")) {
      console.log("User 2 already exists in auth.users, looking up id...");
      const { data: usersData } = await supabase.auth.admin.listUsers();
      user2 = usersData.users.find((u) => u.email === email2);
    } else {
      throw err2;
    }
  } else {
    user2 = created2.user;
  }

  if (!user2) throw new Error("Could not find or create User 2");
  console.log("User 2 ID:", user2.id);

  // Update profile for Account 2
  const { error: profErr2 } = await supabase.from("profiles").upsert({
    id: user2.id,
    email: email2,
    owner_name: "Rohan Verma",
    business_name: "BluePeak Studios",
    job_title: "Creative Director",
    phone: "+91 98123 45678",
    username: "bluepeak",
    slug: "bluepeak",
    is_member: true,
    subscription_plan: "pro",
    status: "expired",
    primary_card_count: 1,
    purchased_id_count: 2,
    subscription_started_at: startedAt2,
    membership_expires_at: expiresAt2,
    follow_up_status: "unattended",
    follow_up_notes: "Account expired. Followed up on WhatsApp for payment link.",
    bio: "Full-service digital branding and production studio.",
    updated_at: new Date().toISOString(),
  });
  if (profErr2) console.error("Profile 2 error:", profErr2);
  else console.log("Profile 2 updated successfully (BluePeak Studios).");

  // Ensure card exists
  await supabase.from("cards").upsert({
    profile_id: user2.id,
    public_slug: "bluepeak",
    is_active: true,
  });

  // Add 1 employee
  await supabase.from("employees").upsert([
    {
      owner_id: user2.id,
      name: "Anita Desai",
      designation: "Brand Strategist",
      email: "anita@bluepeak.in",
      phone: "+91 98123 45679",
      slug: "anita-desai",
      is_active: true,
      is_premium: true,
      subscription_started_at: startedAt2,
      subscription_expires_at: expiresAt2,
      status: "expired",
    },
  ]);
  console.log("Added 1 team member for BluePeak.");

  console.log("\n=======================================================");
  console.log(" SUCCESS! Both test accounts have been created in your Supabase DB!");
  console.log("=======================================================");
}

main().catch((err) => {
  console.error("Error executing seed:", err);
  process.exit(1);
});
