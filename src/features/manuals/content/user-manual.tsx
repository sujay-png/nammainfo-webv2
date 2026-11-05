import Link from "next/link";
import { Callout, Screens, Section, Step, Steps, Sub } from "@/features/manuals/components/manual-blocks";
import type { TocEntry } from "@/features/manuals/components/manual-toc";
import s from "@/features/manuals/components/manual.module.css";

/*
 * The Namma Info user manual. Every picture is a real screenshot of the app
 * (public/manuals/user), taken with a demo business: "Shenoy Hardware & Paints".
 */

const img = (name: string) => `/manuals/user/${name}.webp`;

export const userManualToc: TocEntry[] = [
  { id: "welcome", title: "Welcome to Namma Info", children: [
    { id: "what-you-get", title: "What you get" },
    { id: "how-a-tap-works", title: "How a tap works" },
  ] },
  { id: "getting-started", title: "Create your account", children: [
    { id: "create-account", title: "Sign up" },
    { id: "sign-in", title: "Sign in" },
    { id: "forgot-password", title: "Forgot your password?" },
    { id: "staff-login", title: "Team member login" },
    { id: "sign-in-messages", title: "Messages you might see" },
  ] },
  { id: "profile", title: "Build your profile", children: [
    { id: "profile-overview", title: "The Profile screen" },
    { id: "profile-basics", title: "Step 1: Name, business and link" },
    { id: "profile-photos", title: "Step 2: Logo and cover photo" },
    { id: "profile-about", title: "Step 3: About your business" },
    { id: "profile-services", title: "Step 4: Services and products" },
    { id: "profile-more", title: "Step 5: Social, gallery, payments, brochure" },
    { id: "profile-testimonials", title: "Step 6: Testimonials" },
    { id: "profile-clients", title: "Step 7: Our clients" },
    { id: "profile-reviews-link", title: "Step 8: Link Google reviews" },
    { id: "profile-complete", title: "Check your profile is complete" },
  ] },
  { id: "go-live", title: "Make your page live", children: [
    { id: "plans", title: "Plans at a glance" },
    { id: "free-trial", title: "100-day free trial" },
    { id: "upgrade", title: "Upgrade to Pro" },
    { id: "locked-page", title: "If your page shows as locked" },
  ] },
  { id: "your-page", title: "Your business page", children: [
    { id: "page-tour", title: "What visitors see" },
    { id: "sharing", title: "Sharing your card" },
  ] },
  { id: "visitors", title: "When someone opens your card", children: [
    { id: "visitor-details", title: "Visitors share their details" },
    { id: "visitor-card-photo", title: "Scanning their business card" },
    { id: "keep-card", title: "Keeping the card" },
  ] },
  { id: "saved", title: "Contacts and saved cards", children: [
    { id: "contacts", title: "Contacts" },
    { id: "saved-cards", title: "Saved cards" },
  ] },
  { id: "reviews", title: "Google reviews made easy", children: [
    { id: "reviews-customer", title: "What your customer does" },
    { id: "reviews-how", title: "How suggestions are written" },
  ] },
  { id: "team", title: "Your team", children: [
    { id: "team-slots", title: "Team card slots" },
    { id: "team-add", title: "Adding a team member" },
    { id: "team-login", title: "Giving a member their own login" },
  ] },
  { id: "home-scan", title: "Home, Scan and taps", children: [
    { id: "home", title: "Home" },
    { id: "scan", title: "Scan" },
    { id: "taps", title: "How taps are counted" },
  ] },
  { id: "settings", title: "Settings, orders and the app", children: [
    { id: "settings-list", title: "Settings" },
    { id: "orders", title: "Card orders" },
    { id: "install", title: "Add Namma Info to your home screen" },
  ] },
  { id: "faq", title: "Questions and answers" },
  { id: "privacy", title: "Privacy and safety" },
];

export default function UserManualContent() {
  return (
    <>
      {/* ------------------------------------------------------------ */}
      <Section id="welcome" num={1} title="Welcome to Namma Info">
        <p className={s.lead}>
          Namma Info gives your business a smart visiting card. When someone holds your card near their phone, your
          business page opens on their screen. From there they can call you, message you on WhatsApp, get directions,
          save your number and leave you a Google review. They don&apos;t need to install anything.
        </p>
        <p>
          <em>Namma</em> means <em>ours</em> in Kannada. The idea is simple: your details, always up to date, always one
          tap away.
        </p>

        <Sub id="what-you-get" title="What you get">
          <div className={s.tableWrap}>
            <table>
              <thead>
                <tr><th>Part</th><th>What it is</th></tr>
              </thead>
              <tbody>
                <tr><td>A smart card</td><td>A real card with a small chip inside (called <strong>NFC</strong>). Phones read the chip when the card touches them, the same way you tap a bank card to pay.</td></tr>
                <tr><td>Your business page</td><td>A web page at an address like <strong>nammainfo.in/yourname</strong>, with your photo, business, services, location and contact buttons.</td></tr>
                <tr><td>Your dashboard</td><td>The private side of the app. Here you edit your page, see who visited, manage your team and track taps.</td></tr>
              </tbody>
            </table>
          </div>
        </Sub>

        <Sub id="how-a-tap-works" title="How a tap works">
          <Steps>
            <Step>You hold your Namma Info card near the back of the other person&apos;s phone.</Step>
            <Step>Their phone shows a small notification. They tap it.</Step>
            <Step>Your business page opens in their browser.</Step>
            <Step>They save your number, call you, or leave their own details for you.</Step>
            <Step>Their details appear in <strong>Saved → Contacts</strong> on your dashboard, so you can follow up.</Step>
          </Steps>
          <Callout kind="tip">
            <p>If their phone can&apos;t read the card, show your <strong>QR code</strong> or send your link instead. It opens the same page.</p>
          </Callout>
          <Callout kind="info" title="How to read this manual">
            <p>Words in <strong>bold</strong> are the names of buttons and screens. Every picture is a real screenshot of the app, taken with a demo business called <em>Shenoy Hardware &amp; Paints</em>. Tap any picture to enlarge it.</p>
          </Callout>
        </Sub>
      </Section>

      {/* ------------------------------------------------------------ */}
      <Section id="getting-started" num={2} title="Create your account">
        <p>You need an email address and a password. Setting up takes about two minutes.</p>

        <Sub id="create-account" title="Sign up">
          <Steps>
            <Step title="Open nammainfo.in">On your phone or computer, tap <strong>Get your card</strong>.</Step>
            <Step title="Choose Create account">Make sure <strong>Create account</strong> is selected at the top.</Step>
            <Step title="Enter your email, mobile number and a password">Your <strong>mobile number</strong> is required: customers call and WhatsApp you on it. Type the 10 digits; +91 is added for you. The password needs at least 6 characters. The coloured bar under the password shows how strong it is. Tap the eye icon to see what you typed.</Step>
            <Step title="Tap Create my card">If you see <strong>Check your email</strong>, open the email from Namma Info and tap the link inside. This proves the email address is yours.</Step>
          </Steps>
          <Screens
            shots={[
              { src: img("landing"), title: "nammainfo.in", caption: "Tap Get your card to start." },
              { src: img("signup"), title: "Create account", caption: "Email and password, then Create my card. (The mobile number box now sits between them.)" },
            ]}
          />
          <Callout kind="tip">
            <p>Right after you sign in, Namma Info offers to add itself to your home screen so it opens like an app. See <a href="#install">Add Namma Info to your home screen</a>.</p>
          </Callout>
        </Sub>

        <Sub id="sign-in" title="Sign in">
          <Steps>
            <Step>Go to <strong>nammainfo.in</strong> and tap <strong>Log in</strong> (or go straight to <strong>nammainfo.in/login</strong>).</Step>
            <Step>Enter your email and password and tap <strong>Sign in</strong>.</Step>
            <Step>You land on your <strong>Home</strong> screen. You stay signed in on that phone until you sign out.</Step>
          </Steps>
          <Screens shots={[{ src: img("signin"), title: "Sign in", caption: "The same screen, with Sign in selected." }]} />
        </Sub>

        <Sub id="forgot-password" title="Forgot your password?">
          <Steps>
            <Step>On the sign-in screen, tap <strong>Forgot password?</strong> (under the password box).</Step>
            <Step>Enter the email address you signed up with and tap <strong>Send reset link</strong>.</Step>
            <Step>Open the email and tap <strong>Reset password</strong>.</Step>
            <Step>Choose a new password and save it. You are signed in straight away.</Step>
          </Steps>
          <Screens shots={[{ src: img("forgot"), title: "Forgot password", caption: "We email you a one-time link." }]} />
          <Callout kind="warn">
            <p>The link works once and expires after a while. If it says the link has expired, ask for a new one, and open the email on the same phone you asked from.</p>
          </Callout>
        </Sub>

        <Sub id="staff-login" title="Team member login">
          <p>
            If your employer gave you a Namma Info login, they will share an email address and a password with you. Go to{" "}
            <strong>nammainfo.in/login</strong> and sign in with them. You will see your own card, the contacts who opened
            it, and your settings. If you can&apos;t sign in, ask your owner to check that your login is switched on under{" "}
            <strong>Team</strong>.
          </p>
        </Sub>

        <Sub id="sign-in-messages" title="Messages you might see">
          <div className={s.tableWrap}>
            <table>
              <thead><tr><th>Message</th><th>What it means</th><th>What to do</th></tr></thead>
              <tbody>
                <tr><td>That email and password don&apos;t match our records</td><td>The email or password is wrong</td><td>Check for typing mistakes, or use Forgot password</td></tr>
                <tr><td>An account with that email already exists</td><td>You already signed up with this email</td><td>Tap <strong>Sign in</strong> instead</td></tr>
                <tr><td>Please confirm your email first</td><td>You haven&apos;t tapped the link in the welcome email</td><td>Open the email, tap the link, then sign in</td></tr>
                <tr><td>Enter a valid 10-digit mobile number</td><td>The mobile number is missing or has a typo</td><td>Type your 10-digit number, for example 98765 43210</td></tr>
                <tr><td>Couldn&apos;t connect to Namma Info</td><td>Your phone is offline, or your Wi-Fi or office network is blocking us</td><td>Try again; if it keeps happening, switch to mobile data</td></tr>
                <tr><td>Too many attempts</td><td>Several tries in a short time</td><td>Wait one minute, then try again</td></tr>
              </tbody>
            </table>
          </div>
        </Sub>
      </Section>

      {/* ------------------------------------------------------------ */}
      <Section id="profile" num={3} title="Build your profile">
        <p>
          Your profile is the page people see when they tap your card. The more you fill in, the more useful it is. Follow
          the steps below in order; each takes a minute or two. You can change everything later.
        </p>

        <Sub id="profile-overview" title="The Profile screen">
          <p>
            Tap <strong>Profile</strong> in the bar at the bottom. At the top are your cover photo, logo, name and link. Below are
            sections: <strong>About</strong>, <strong>Social</strong>, <strong>Services &amp; Products</strong>, <strong>Gallery</strong>,{" "}
            <strong>Reviews</strong>, <strong>Banking &amp; Payments</strong> and <strong>Brochure</strong>. Each section has a
            pencil button to edit it and an arrow to open it.
          </p>
          <Screens
            shots={[
              { src: img("profile-empty"), title: "A new profile", caption: "Empty at first. The camera icons add photos; the pencil edits your details." },
              { src: img("profile-sections"), title: "Profile sections", caption: "Each section has its own pencil (edit) button." },
            ]}
          />
        </Sub>

        <Sub id="profile-basics" title="Step 1: Name, business and link">
          <Steps>
            <Step>On the Profile screen, tap the <strong>pencil</strong> next to your name.</Step>
            <Step title="Fill in Edit Profile">
              <strong>Your Name</strong>, <strong>Business Name</strong>, <strong>Job Title</strong> (for example Proprietor),{" "}
              <strong>Mobile number</strong> (required), <strong>Email</strong> and <strong>Website</strong>.
            </Step>
            <Step title="Choose your link">
              In <strong>Username (vanity URL)</strong>, type the name for your page, for example <em>shenoyhardware</em>. Your
              page will be <strong>nammainfo.in/shenoyhardware</strong>. Use small letters and numbers only; if it&apos;s taken, try another.
            </Step>
            <Step>Tap <strong>Save changes</strong>.</Step>
          </Steps>
          <Screens shots={[{ src: img("edit-basic"), title: "Edit Profile", caption: "Name, business, job title, link, phone, email and website." }]} />
        </Sub>

        <Sub id="profile-photos" title="Step 2: Logo and cover photo">
          <Steps>
            <Step>Tap the <strong>camera</strong> on the square photo to add your logo or your own photo.</Step>
            <Step>Tap the <strong>camera</strong> at the top right of the dark banner to add a wide cover photo, for example your shop front.</Step>
            <Step title="Crop and apply">Drag the photo to position it, use the slider to zoom, then tap <strong>Apply</strong>. Photos can be up to 5 MB (JPG or PNG).</Step>
          </Steps>
          <Screens
            shots={[
              { src: img("crop-cover"), title: "Crop Cover Photo", caption: "Drag and zoom, then Apply." },
              { src: img("profile-filled"), title: "With logo and cover", caption: "Your name, title and link appear under the photos." },
            ]}
          />
        </Sub>

        <Sub id="profile-about" title="Step 3: About your business">
          <p>Tap the pencil on <strong>About</strong>. This is the most important section for customers.</p>
          <Steps>
            <Step title="What best describes your business?">
              Pick one: Retailer / Shop, Wholesaler, Distributor / Dealer, Manufacturer / Maker, Service provider, Agency / Consultant or
              Freelancer. Namma Info uses this to write review suggestions that fit what you actually do.
            </Step>
            <Step title="About your business">
              Two or three sentences: what you sell or do, where, and since when. For example: <em>&ldquo;Paint and hardware store in Kadri,
              Mangaluru since 2009…&rdquo;</em>
            </Step>
            <Step title="Address">Street address or landmark, city and PIN code.</Step>
            <Step title="Google Maps link (optional)">Open your shop in Google Maps → Share → Copy link, and paste it. This adds a <strong>Get Directions</strong> button.</Step>
            <Step title="Numbers that build trust">Coverage area, years in business, clients served, and your GST number if you have one. Years and clients appear as badges at the top of your page.</Step>
            <Step>Tap <strong>Save changes</strong>.</Step>
          </Steps>
          <Screens
            shots={[
              { src: img("edit-about"), title: "Edit About (top)", caption: "Business type, description and address." },
              { src: img("edit-about-2"), title: "Edit About (bottom)", caption: "Maps link, coverage area, years, clients, GST." },
            ]}
          />
        </Sub>

        <Sub id="profile-services" title="Step 4: Services and products">
          <Steps>
            <Step>Tap the pencil on <strong>Services &amp; Products</strong>.</Step>
            <Step>Tap <strong>Add service</strong> for work you do (for example <em>Colour matching</em>), or <strong>Add product</strong> for things you sell (for example <em>Interior wall paint</em>).</Step>
            <Step>For each one add a name, a one-line description, an optional price, and an optional photo and category. Categories (for example <em>Paints</em>, <em>Hardware</em>) group items on your page.</Step>
            <Step>Tap <strong>Save changes</strong>.</Step>
          </Steps>
          <Screens shots={[{ src: img("edit-services"), title: "Services & Products", caption: "Each item has a name, description, price and category." }]} />
          <Callout kind="tip">
            <p>Your services and products also power your <a href="#reviews">Google review suggestions</a>, so describe them in plain words.</p>
          </Callout>
        </Sub>

        <Sub id="profile-more" title="Step 5: Social, gallery, payments, brochure">
          <div className={s.tableWrap}>
            <table>
              <thead><tr><th>Section</th><th>What to add</th><th>Tip</th></tr></thead>
              <tbody>
                <tr><td>Social</td><td>Instagram, Facebook, LinkedIn, YouTube, WhatsApp and more. Tap <strong>Add link</strong>, choose the app, paste your link.</td><td>Add only the ones you actually use.</td></tr>
                <tr><td>Gallery</td><td>Photos of your shop, work or products, with optional captions and categories.</td><td>Clear, bright photos work best.</td></tr>
                <tr><td>Banking &amp; Payments</td><td>Bank name, account holder, account number, IFSC, UPI ID.</td><td>Customers see these on your page. Add them only if you want them public.</td></tr>
                <tr><td>Brochure</td><td>A PDF brochure or catalogue.</td><td>Visitors can open or download it.</td></tr>
              </tbody>
            </table>
          </div>
        </Sub>

        <Sub id="profile-testimonials" title="Step 6: Testimonials">
          <p>Show what happy customers say about you. Each testimonial appears as a card on your page that visitors can swipe through.</p>
          <Steps>
            <Step>Tap the pencil on <strong>Testimonials</strong>.</Step>
            <Step title="Fill in the testimonial">
              The person&apos;s <strong>Name</strong> (required), their <strong>Role or company</strong> (optional), a star rating, and{" "}
              <strong>What they said</strong> (required, up to 500 characters).
            </Step>
            <Step title="Add their photo (optional)">
              Tap the round <strong>camera</strong> and choose any photo. Namma Info crops it to a circle-friendly square and shrinks it
              automatically, so even a large phone photo uploads in a second. Without a photo, their initials are shown.
            </Step>
            <Step>Tap <strong>Add testimonial</strong> for more (up to 20), then <strong>Save changes</strong>.</Step>
          </Steps>
          <Callout kind="tip">
            <p>Use real words from real customers, with their permission. A short, specific quote (&ldquo;Matched our wall colour exactly, delivered the same day&rdquo;) is more convincing than a long general one.</p>
          </Callout>
        </Sub>

        <Sub id="profile-clients" title="Step 7: Our clients">
          <p>Show the businesses you&apos;ve worked with as a row of logos. This section is optional.</p>
          <Steps>
            <Step>Tap the pencil on <strong>Our Clients</strong>.</Step>
            <Step title="Add a client">
              Type the <strong>Client name</strong> (required). Tap the <strong>Logo</strong> box to add their logo (optional); it&apos;s resized
              automatically and transparent logos stay transparent.
            </Step>
            <Step title="Add their website (optional)">
              For example <em>acme.com</em>. When visitors tap the logo, the client&apos;s website opens in a new tab. Leave it empty and the
              logo is just shown.
            </Step>
            <Step>Tap <strong>Add client</strong> for more (up to 50), then <strong>Save changes</strong>.</Step>
          </Steps>
        </Sub>

        <Sub id="profile-reviews-link" title="Step 8: Link Google reviews">
          <Steps>
            <Step>Open the <strong>Reviews</strong> section and tap <strong>Link Google Reviews</strong>.</Step>
            <Step>
              Paste your Google review link. The best one: Google Business Profile → <strong>Get more reviews</strong> → Copy link. Your
              Google Maps share link also works.
            </Step>
            <Step>Tap <strong>Link</strong>. A <strong>Google Reviews</strong> button now appears on your page.</Step>
          </Steps>
          <Screens shots={[{ src: img("reviews-link"), title: "Paste Google Review Link", caption: "Paste the link and tap Link." }]} />
        </Sub>

        <Sub id="profile-complete" title="Check your profile is complete">
          <p>
            <strong>Home</strong> shows <strong>Profile Completion</strong> as a percentage and lists what&apos;s still missing. Tap a
            missing item to jump to it. You need <strong>60%</strong> to apply for the free trial and <strong>100%</strong> to order your
            physical card, so your card is printed with the right details.
          </p>
          <Screens
            shots={[
              { src: img("home-completion"), title: "Profile Completion on Home", caption: "91%: only social links are missing." },
              { src: img("profile-complete-gate"), title: "Complete Profile Before Upgrading", caption: "Shown if you order a card before reaching 100%." },
            ]}
          />
          <p>Changes show on your public page within about a minute.</p>
        </Sub>
      </Section>

      {/* ------------------------------------------------------------ */}
      <Section id="go-live" num={4} title="Make your page live">
        <p>
          You can create your account and build your profile for free. To make your page visible to visitors and get your
          physical NFC card, you need <strong>Pro</strong> or an approved <strong>Free Trial</strong>.
        </p>

        <Sub id="plans" title="Plans at a glance">
          <div className={s.tableWrap}>
            <table>
              <thead><tr><th>Plan</th><th>Price</th><th>What you get</th><th>How long</th></tr></thead>
              <tbody>
                <tr><td>Free</td><td>₹0</td><td>Build and edit your profile, save other people&apos;s cards</td><td>No limit, but your public page is locked to visitors</td></tr>
                <tr><td>Free Trial</td><td>₹0 with code <strong>ADI100</strong></td><td>Your public page goes live</td><td>100 days from approval</td></tr>
                <tr><td>Pro</td><td>₹1,999 for 1 card</td><td>Live page, your own link, a custom NFC card with free doorstep delivery</td><td>1 year</td></tr>
                <tr><td>Team cards</td><td>₹1,999 / ₹1,499 / ₹999 per card</td><td>One card and page per team member</td><td>Same end date as your Pro plan</td></tr>
              </tbody>
            </table>
          </div>
          <p><strong>Volume pricing.</strong> The price per card depends on the total number of cards in your business (yours plus your team&apos;s): 1 to 4 cards ₹1,999 each, 5 to 24 cards ₹1,499 each, 25 or more ₹999 each.</p>
        </Sub>

        <Sub id="free-trial" title="100-day free trial">
          <Steps>
            <Step>Fill in at least <strong>60%</strong> of your profile.</Step>
            <Step>On <strong>Home</strong>, tap <strong>Apply for Free Trial</strong>, enter the code <strong>ADI100</strong> (or tap <strong>Apply Code</strong>) and tap <strong>Apply for 100-Day Free Trial</strong>.</Step>
            <Step>Your Home screen shows <strong>Waiting for Approval</strong>. The Namma Info team reviews it and switches on your trial.</Step>
            <Step>The 100 days start from the day it&apos;s approved. Upgrade to Pro any time to keep your page live after the trial.</Step>
          </Steps>
          <Screens
            shots={[
              { src: img("trial-apply"), title: "100-Day Free Trial", caption: "Your profile must be at least 60% complete." },
              { src: img("trial-pending"), title: "Waiting for Approval", caption: "Shown on Home until the team approves it." },
            ]}
          />
        </Sub>

        <Sub id="upgrade" title="Upgrade to Pro">
          <Steps>
            <Step>On <strong>Home</strong>, tap <strong>Upgrade to Pro</strong> (or <strong>Settings → Membership &amp; Plan</strong>).</Step>
            <Step title="Design">Upload your existing visiting card or artwork, or choose <strong>Enter Details for Card Design</strong> and our team designs it. Your details are filled in from your profile.</Step>
            <Step title="Shipping">Tick <strong>Same as address in profile</strong>, or enter where the card should be delivered.</Step>
            <Step title="Review &amp; Pay">Check the summary and tap <strong>Pay ₹1,999 via Razorpay</strong>. Pay by UPI, card or net banking. Your plan starts straight away.</Step>
          </Steps>
          <Screens
            shots={[
              { src: img("upgrade-design"), title: "1 · Design", caption: "Upload your card, or let our team design it." },
              { src: img("upgrade-details"), title: "Card details", caption: "Filled in from your profile." },
              { src: img("upgrade-shipping"), title: "2 · Shipping", caption: "Where to deliver your card." },
              { src: img("upgrade-pay"), title: "3 · Review & Pay", caption: "Secure payment through Razorpay." },
            ]}
          />
          <Callout kind="info" title="Your payment is safe">
            <p>Payments are handled by Razorpay. Namma Info never sees or stores your card number or UPI PIN. If you close the page during payment, your payment is still recorded.</p>
          </Callout>
        </Sub>

        <Sub id="locked-page" title="If your page shows as locked">
          <p>
            Visitors see <strong>Profile Available on Pro Plan</strong> when your account is on the free tier, or your plan or trial has
            ended. Your profile and contacts are kept. Upgrade, renew or apply for the trial and your page goes live again straight away.
          </p>
          <Screens shots={[{ src: img("page-locked"), title: "A locked page", caption: "What visitors see before your plan is active." }]} />
        </Sub>
      </Section>

      {/* ------------------------------------------------------------ */}
      <Section id="your-page" num={5} title="Your business page">
        <Sub id="page-tour" title="What visitors see">
          <p>When someone opens your link or taps your card, they see:</p>
          <ul>
            <li><strong>Your photo, name, title and business</strong>, with badges such as years in business and clients served.</li>
            <li><strong>Add to Contacts</strong>: saves your name, business, phone, email, website and photo to their phone in one step.</li>
            <li><strong>Call</strong>, <strong>WhatsApp</strong>, <strong>Email</strong>, <strong>Share</strong> and <strong>Get Directions</strong>.</li>
            <li>Sections they can open: <strong>About Us</strong>, <strong>Services</strong>, <strong>Products</strong>, gallery, <strong>Testimonials</strong>, <strong>Our Clients</strong> (tap a logo to open that client&apos;s website), brochure, <strong>Write a Google Review</strong> and payment details. Empty sections are hidden.</li>
          </ul>
          <Screens
            shots={[
              { src: img("page-top"), title: "Top of your page", caption: "Contact buttons first, so it's one tap to call or save." },
              { src: img("page-sections"), title: "Sections", caption: "About, services, products, reviews and more." },
              { src: img("page-about"), title: "About Us", caption: "Your description, address and coverage area." },
            ]}
          />
        </Sub>

        <Sub id="sharing" title="Sharing your card">
          <div className={s.tableWrap}>
            <table>
              <thead><tr><th>Way</th><th>How</th><th>Best for</th></tr></thead>
              <tbody>
                <tr><td>Tap the card</td><td>Hold your card flat against the back of their phone, near the top, for 1 to 2 seconds</td><td>Meeting people in person</td></tr>
                <tr><td>QR code</td><td>The QR code printed on your Namma Info card; they point their camera at it</td><td>Older phones, or phones with NFC switched off</td></tr>
                <tr><td>Your link</td><td>On <strong>Profile</strong>, tap the <strong>share</strong> or <strong>QR</strong> button and send your link on WhatsApp, SMS or email</td><td>Sharing from a distance</td></tr>
              </tbody>
            </table>
          </div>
          <ul>
            <li><strong>iPhone:</strong> iPhone XS and newer read the card automatically when the screen is on. A notification appears at the top; tap it.</li>
            <li><strong>Android:</strong> most phones read it when <strong>NFC</strong> is switched on (Settings → Connected devices → NFC).</li>
            <li><strong>Any phone:</strong> the QR code and the link always work.</li>
          </ul>
        </Sub>
      </Section>

      {/* ------------------------------------------------------------ */}
      <Section id="visitors" num={6} title="When someone opens your card">
        <Sub id="visitor-details" title="Visitors share their details">
          <p>
            The first time someone opens your page, a small box asks them to <strong>share their contact details</strong>, so you can save
            their number and get back to them. They can type their name and mobile number (or email), scan their business card, or tap{" "}
            <strong>Skip</strong>. They are asked only once on that phone. Signed-in Namma Info users share their details without the box.
          </p>
          <Screens shots={[{ src: img("visitor-popup"), title: "Share your contact details", caption: "Name and number, or scan a business card." }]} />
        </Sub>

        <Sub id="visitor-card-photo" title="Scanning their business card">
          <p>
            A visitor can tap <strong>Scan your business card</strong>. The camera opens for the front of their paper card, then the back.
            As soon as the back is taken they go straight to your page, and the photos upload in the background. Photos are shrunk to a
            small size and stored privately: only you (and the team member whose card they opened) can see them.
          </p>
        </Sub>

        <Sub id="keep-card" title="Keeping the card">
          <p>
            If a visitor isn&apos;t signed in and is about to leave your page, Namma Info asks <strong>Save this card before you go?</strong>{" "}
            and offers a free account. After they sign up, your card is waiting in their <strong>Saved</strong> list.
          </p>
        </Sub>
      </Section>

      {/* ------------------------------------------------------------ */}
      <Section id="saved" num={7} title="Contacts and saved cards">
        <p>
          The <strong>Saved</strong> tab has two lists. <strong>Contacts</strong> are people who opened <em>your</em> card and left their
          details. <strong>Saved cards</strong> are other people&apos;s Namma Info cards that <em>you</em> opened.
        </p>

        <Sub id="contacts" title="Contacts">
          <p>Tap a contact to:</p>
          <ul>
            <li><strong>Call</strong>, <strong>WhatsApp</strong> or <strong>Email</strong> them in one tap.</li>
            <li>Put them in a category: <strong>New</strong>, <strong>Hot lead</strong>, <strong>Customer</strong>, or one you create with <strong>New category</strong>.</li>
            <li>Write a <strong>Note</strong>, for example <em>Wants a quote for 50 litres</em>.</li>
            <li>See their <strong>business card photos</strong> (front and back). Tap a photo to see it full size.</li>
            <li><strong>Edit details</strong> to fix the name or number, or type them in from the card photo.</li>
            <li><strong>Delete contact</strong> (tap twice to confirm). This also deletes their card photos.</li>
          </ul>
          <p>If the same person opens your card again, Namma Info updates their entry instead of creating a duplicate.</p>
        </Sub>

        <Sub id="saved-cards" title="Saved cards">
          <p>
            When you&apos;re signed in and open someone else&apos;s Namma Info card, it&apos;s saved to <strong>Saved → Saved cards</strong>{" "}
            automatically, with an <strong>Undo</strong> button in case you didn&apos;t mean to. Tap a saved card any time to open it again.
          </p>
        </Sub>
      </Section>

      {/* ------------------------------------------------------------ */}
      <Section id="reviews" num={8} title="Google reviews made easy">
        <p>
          Happy customers often want to leave a review but don&apos;t know what to write. Namma Info writes ready-made reviews for them,
          based on what you actually sell, so they only need to copy, paste and post.
        </p>

        <Sub id="reviews-customer" title="What your customer does">
          <Steps>
            <Step>On your page, they open <strong>Write a Google Review</strong> and see a few ready-made reviews. If your services have categories, they can pick a category first.</Step>
            <Step>They tap the review they like. It&apos;s copied, and a box explains the next step.</Step>
            <Step>They tap the button to open Google, paste the review, choose the stars and post.</Step>
            <Step>If none fit, they tap the refresh button for new suggestions.</Step>
          </Steps>
          <Screens
            shots={[
              { src: img("reviews-suggestions"), title: "Review suggestions", caption: "Written from your business type, products and services." },
              { src: img("reviews-copied"), title: "Copied", caption: "Shows how to paste it on Google." },
            ]}
          />
        </Sub>

        <Sub id="reviews-how" title="How suggestions are written">
          <ul>
            <li>Each review has three short paragraphs: your business and people, the specific service or product, and a recommendation.</li>
            <li>They use your details where you&apos;ve added them: years in business, clients served and your area.</li>
            <li>A retailer, a manufacturer and a freelancer get differently worded reviews, so they sound natural.</li>
            <li>The wording changes every time. A phone that already copied an opening line won&apos;t be offered it again for your business, so reviews don&apos;t look copied.</li>
          </ul>
          <Callout kind="warn" title="Good practice">
            <p>Only ask real customers for reviews, and let them edit the text so it reflects their own experience. Google can remove reviews that look fake.</p>
          </Callout>
        </Sub>
      </Section>

      {/* ------------------------------------------------------------ */}
      <Section id="team" num={9} title="Your team">
        <p>
          Give your sales staff their own Namma Info card. Each team member gets their own page, linked to your business, at an address
          like <strong>nammainfo.in/yourbusiness/ravi</strong>. Every contact they collect is visible to you.
        </p>

        <Sub id="team-slots" title="Team card slots">
          <p>
            Go to <strong>Settings → Team / Employees</strong>. Each member uses one <strong>slot</strong>; the top of the screen shows how many
            you have and how many are used. To buy more, tap <strong>Buy More Team Cards</strong>, choose how many and pay. The price per card
            drops as your team grows.
          </p>
          <Screens
            shots={[
              { src: img("team"), title: "Team / Employees", caption: "Slots used, and your team members." },
              { src: img("team-buy"), title: "Add Team Member Cards", caption: "Volume pricing is applied automatically." },
            ]}
          />
        </Sub>

        <Sub id="team-add" title="Adding a team member">
          <Steps>
            <Step>On the Team screen, tap <strong>Add Member</strong>.</Step>
            <Step>Enter their name and designation (for example <em>Sales Executive</em>), and optionally their email and phone.</Step>
            <Step>Tap <strong>Add Member</strong> to save. You can edit their details, change their photo and cover, or remove them later.</Step>
          </Steps>
        </Sub>

        <Sub id="team-login" title="Giving a member their own login">
          <Steps>
            <Step>Open the team member and find <strong>Give them their own dashboard</strong>.</Step>
            <Step>Enter the email address they will sign in with and tap <strong>Create login</strong>.</Step>
            <Step>Namma Info creates a temporary password. Tap <strong>Copy details</strong> and send them to the team member on WhatsApp.</Step>
            <Step>They sign in at <strong>nammainfo.in/login</strong> and can change their password in Settings.</Step>
          </Steps>
          <div className={s.tableWrap}>
            <table>
              <thead><tr><th>Team members can</th><th>Team members can&apos;t</th></tr></thead>
              <tbody>
                <tr><td>See and share their own card</td><td>Edit your business details</td></tr>
                <tr><td>See the contacts who opened their card</td><td>See contacts from other members&apos; cards</td></tr>
                <tr><td>Change their own photo and cover</td><td>Add or remove team members, or buy anything</td></tr>
                <tr><td>Change their password and appearance</td><td>Change your plan or payments</td></tr>
              </tbody>
            </table>
          </div>
          <Callout kind="tip">
            <p><strong>Pause</strong> a login when someone is on leave or leaves the company, and use <strong>Set new password</strong> if they forget theirs.</p>
          </Callout>
        </Sub>
      </Section>

      {/* ------------------------------------------------------------ */}
      <Section id="home-scan" num={10} title="Home, Scan and taps">
        <p>The bar at the bottom of the screen has five tabs: <strong>Home</strong>, <strong>Saved</strong>, <strong>Scan</strong> (the round button), <strong>Profile</strong> and <strong>Settings</strong>.</p>

        <Sub id="home" title="Home">
          <ul>
            <li><strong>Card taps</strong>, <strong>Reviews</strong>, <strong>Team</strong> and <strong>Connections</strong> at a glance.</li>
            <li><strong>Account Status</strong>: your plan, days left and physical card status, with Upgrade, trial or Renew buttons.</li>
            <li><strong>Profile Completion</strong> and shortcuts to Edit Profile, Scan Card and Settings.</li>
            <li><strong>Recent Connections</strong> and <strong>Business Stats</strong>.</li>
          </ul>
          <Screens
            shots={[
              { src: img("home-pro"), title: "Home on an active plan", caption: "Plan, days left and valid-till date." },
              { src: img("home-free"), title: "Home on the free plan", caption: "Upgrade to Pro or apply for the free trial." },
            ]}
          />
        </Sub>

        <Sub id="scan" title="Scan">
          <p>Use <strong>Scan</strong> to open someone else&apos;s Namma Info card from your phone:</p>
          <ul>
            <li><strong>Open Camera Scanner</strong>: point it at their QR code. Use the flash and switch-camera buttons if it&apos;s dark.</li>
            <li><strong>Scan from Photo / Gallery</strong>: pick a screenshot or photo of their QR code.</li>
            <li><strong>NFC</strong> (Android with Chrome): hold their card to the back of your phone.</li>
            <li><strong>Enter card link or username</strong>: type their link, for example <em>nammainfo.in/ravi</em>, and tap <strong>Open</strong>.</li>
          </ul>
          <Screens shots={[{ src: img("scan"), title: "Scan Card", caption: "Camera, photo, NFC or a typed link." }]} />
          <p>If you see <em>Camera access was denied</em>, allow camera access for your browser in your phone&apos;s settings, then try again.</p>
        </Sub>

        <Sub id="taps" title="How taps are counted">
          <p>A tap is counted each time someone opens your page by tapping your card, scanning your QR or opening your link. If the same person opens it several times in one visit, it counts once.</p>
        </Sub>
      </Section>

      {/* ------------------------------------------------------------ */}
      <Section id="settings" num={11} title="Settings, orders and the app">
        <Sub id="settings-list" title="Settings">
          <div className={s.tableWrap}>
            <table>
              <thead><tr><th>Setting</th><th>What it does</th></tr></thead>
              <tbody>
                <tr><td>Edit Profile</td><td>Opens your profile editor</td></tr>
                <tr><td>Team / Employees</td><td>Add team members, give them logins, buy team cards</td></tr>
                <tr><td>Card Orders &amp; Fulfillment</td><td>Track your physical card orders</td></tr>
                <tr><td>Membership &amp; Plan</td><td>See your plan and days left; upgrade or renew</td></tr>
                <tr><td>Appearance</td><td><strong>Light</strong>, <strong>Dark</strong> or <strong>System default</strong>, and a colour <strong>Theme</strong> for your page</td></tr>
                <tr><td>Add to home screen</td><td>Install Namma Info like an app</td></tr>
                <tr><td>Help &amp; Support</td><td>Contact the Namma Info team</td></tr>
                <tr><td>Sign out</td><td>Signs you out on this phone</td></tr>
              </tbody>
            </table>
          </div>
          <Screens
            shots={[
              { src: img("settings"), title: "Settings", caption: "Profile, team, orders and plan." },
              { src: img("settings-2"), title: "Appearance and more", caption: "Light, dark, theme, install, help, sign out." },
            ]}
          />
        </Sub>

        <Sub id="orders" title="Card orders">
          <p>Go to <strong>Settings → Card Orders &amp; Fulfillment</strong>. Each order shows its status:</p>
          <Steps>
            <Step title="Under Review">We&apos;ve received your order and payment. You can still change your card design.</Step>
            <Step title="In Production">Your card is being printed and the chip is being set up. The design can no longer change.</Step>
            <Step title="Delivered">Your card has arrived.</Step>
          </Steps>
          <Screens shots={[{ src: img("orders"), title: "Card Orders & Fulfillment", caption: "Totals, and each order's progress." }]} />
          <p>
            <strong>Renewing:</strong> when your plan has 15 days or less left, Home and Team show a reminder. Tap <strong>Renew</strong> to pay for
            another year for you and your active team members. If you renew early, the new year is added to your current end date, so you never lose days.
          </p>
        </Sub>

        <Sub id="install" title="Add Namma Info to your home screen">
          <p>Namma Info works in your phone&apos;s browser, and you can add it to your home screen so it opens full-screen with one tap. Right after you sign in, the app offers to do this.</p>
          <p><strong>Android (Chrome, Samsung Internet, Edge):</strong> tap <strong>Install app</strong> in the box, or Chrome&apos;s <strong>⋮ menu → Install app / Add to Home screen</strong>, then <strong>Install</strong>.</p>
          <p><strong>iPhone and iPad (Safari):</strong> tap <strong>Share</strong> (the square with an arrow), scroll down, tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>. If you opened the link inside WhatsApp or Instagram, open it in Safari first.</p>
          <Screens shots={[{ src: img("install-android"), title: "Add to your home screen", caption: "Settings → Add to home screen, any time." }]} />
        </Sub>
      </Section>

      {/* ------------------------------------------------------------ */}
      <Section id="faq" num={12} title="Questions and answers">
        <div className={s.faq}>
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <div className={s.faqBody}>{f.a}</div>
            </details>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------------ */}
      <Section id="privacy" num={13} title="Privacy and safety">
        <div className={s.tableWrap}>
          <table>
            <thead><tr><th>Public: anyone with your link can see it</th><th>Private: only you (and the relevant team member)</th></tr></thead>
            <tbody>
              <tr><td>Your name, photo, business, job title</td><td>Contacts who shared their details with you</td></tr>
              <tr><td>Phone, email, website, address and Maps link</td><td>Business card photos visitors uploaded</td></tr>
              <tr><td>About, services, products, gallery, brochure</td><td>Your notes and categories on contacts</td></tr>
              <tr><td>Bank and UPI details, if you add them</td><td>Your plan, orders and payments</td></tr>
              <tr><td>Testimonials and client logos</td><td>Your password</td></tr>
              <tr><td>Social links</td><td></td></tr>
            </tbody>
          </table>
        </div>
        <ul>
          <li>Use a password you don&apos;t use anywhere else, and don&apos;t share it. Give team members their own login instead.</li>
          <li>When a team member leaves, <strong>pause</strong> their login on the Team screen.</li>
          <li>Namma Info will never ask for your password by phone, WhatsApp or email.</li>
          <li>Visitors choose whether to share their details; deleting a contact also deletes their photos.</li>
        </ul>
        <p>
          New here? <Link href="/signup">Create your card</Link>. Building on Namma Info? See the{" "}
          <Link href="/developers-manual">developer documentation</Link>.
        </p>
      </Section>
    </>
  );
}

const FAQ: { q: string; a: React.ReactNode }[] = [
  { q: "Does the other person need to install an app?", a: <p>No. Your page opens in their phone&apos;s normal browser.</p> },
  { q: "Will it work on iPhone?", a: <p>Yes. iPhone XS and newer read the card without any app. For older phones, show your QR code or send your link.</p> },
  {
    q: "Nothing happens when I tap. What should I check?",
    a: (
      <ol>
        <li>The other phone&apos;s screen must be on and unlocked.</li>
        <li>On Android, NFC must be switched on in Settings.</li>
        <li>Touch the card to the top half of the back of the phone and hold it still for 1 to 2 seconds. Thick metal cases can block the signal.</li>
        <li>Still nothing? Use the QR code or your link.</li>
      </ol>
    ),
  },
  { q: "What if I change my number or move shop?", a: <p>Edit your profile. Every card you&apos;ve already handed out opens your new details straight away. You never need to reprint.</p> },
  { q: "I lost my card.", a: <p>Your page and contacts are safe in your account. Contact the Namma Info team to order a replacement.</p> },
  { q: "Visitors see “Profile Available on Pro Plan”. Why?", a: <p>Your account is on the free tier, or your plan or trial has ended. Upgrade, renew or apply for the free trial; your page goes live as soon as your plan is active.</p> },
  { q: "Can I change my link (nammainfo.in/yourname)?", a: <p>Yes, in <strong>Profile → Edit Profile → Username</strong>. The old link stops working, so tell anyone you sent it to. If your physical card is already printed, check with the Namma Info team first.</p> },
  { q: "My changes aren't showing on my page.", a: <p>Wait about a minute and refresh. Public pages update shortly after you save.</p> },
  { q: "Someone opened my card but isn't in my contacts.", a: <p>Visitors can skip sharing their details. Only people who fill in the form, or scan their card, appear in Contacts.</p> },
  { q: "I didn't get the confirmation or password-reset email.", a: <p>Check your spam or promotions folder, wait a few minutes, then ask for a new email. If it still doesn&apos;t arrive, contact the team.</p> },
  { q: "Why is the app asking for my mobile number?", a: <p>A mobile number is now required on every account, because customers call and WhatsApp you from your card. If your account was made before this, you&apos;ll be asked for it once when you open the dashboard. Type your 10-digit number and tap <strong>Save and continue</strong>; you can change it later in <strong>Profile → Edit Profile</strong>.</p> },
  { q: "Can I change the order of my testimonials or clients?", a: <p>Not yet. They appear in the order you added them. To move one to the end, remove it and add it again.</p> },
  { q: "I paid but my plan still shows Free.", a: <p>Refresh Home. If it still shows Free after a few minutes, contact the team with your Razorpay payment ID from your receipt.</p> },
];
