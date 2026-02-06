# Hostgator DNS Setup Guide - CityBeat Magazine
## Step-by-Step Instructions for ads.citybeatmag.co

### Overview
This guide shows exactly how to configure your Hostgator DNS to point to Vercel hosting.

**Your domain:** `citybeatmag.co`
**Subdomain we're setting up:** `ads.citybeatmag.co`
**Where it points:** Vercel (cname.vercel-dns.com)

---

## Step 1: Log Into Hostgator

1. Go to: https://www.hostgator.com/account/
2. Enter your email and password
3. Click "Sign In"
4. You should see your control panel/dashboard

---

## Step 2: Access DNS Management

### Method A (cPanel - Most Common)
1. In Hostgator dashboard, click **"Account"** or **"Control Panel"**
2. Look for **"cPanel"** section
3. Click **"Manage"** next to your domain
4. You'll see the cPanel dashboard
5. Look for **"Zone Editor"** or **"DNS Zone Editor"**
6. Click on your domain: `citybeatmag.co`

### Method B (Hostgator Manager)
1. Click **"Domain"** in Hostgator account
2. Find `citybeatmag.co` in the list
3. Click **"Manage DNS"**
4. You'll see DNS records editor

---

## Step 3: Current DNS Records

You should see records like:
```
Type    Name    Value                      TTL
A       @       192.168.1.1               3600
CNAME   www     citybeatmag.co            3600
MX      @       mail.citybeatmag.co       3600
TXT     @       v=spf1 -all               3600
```

---

## Step 4: Add CNAME Record for Subdomain

You need to **ADD A NEW RECORD** (don't delete existing ones).

### Click "Add Record" or "+"

Fill in these fields:
```
Type:     CNAME
Name:     ads
Value:    cname.vercel-dns.com
TTL:      3600
```

**What each field means:**
- **Type:** CNAME (Canonical Name - points to another domain)
- **Name:** `ads` (This creates `ads.citybeatmag.co`)
- **Value:** `cname.vercel-dns.com` (Vercel's address)
- **TTL:** 3600 seconds (1 hour cache - standard)

**Don't use:**
- ❌ `www.ads.citybeatmag.co` for Name (just use `ads`)
- ❌ Any IP address for Value (must be domain name)
- ❌ A record for CNAME (different record types)

### Click "Save"

You should see:
```
✓ Record created successfully
```

---

## Step 5: Verify in Vercel

Before DNS propagates, tell Vercel about your domain:

1. Go to: https://vercel.com/dashboard
2. Select your project: `citybeat-ads`
3. Go to **Settings** → **Domains**
4. Click **"Add Custom Domain"**
5. Enter: `ads.citybeatmag.co`
6. Click **"Add"**
7. Select **"Using DNS"** (since you're managing DNS at Hostgator)
8. Vercel will show required DNS values
9. **Copy the exact CNAME value Vercel shows** (might be different from above)

**If Vercel shows different CNAME value:**
- Go back to Hostgator
- Edit the CNAME record
- Replace value with Vercel's exact value
- Save

---

## Step 6: Wait for DNS Propagation

DNS changes take time to spread globally:

**Time to propagate:**
- Immediate: Your local computer might see it
- 5-30 minutes: Most users will see it
- Up to 48 hours: All DNS servers worldwide (rare)

**Check progress:**
1. Open terminal/command prompt
2. Run:
   ```bash
   nslookup ads.citybeatmag.co
   ```
3. You should see Vercel's IP addresses:
   ```
   Server:  resolver.hostgator.com
   Address: x.x.x.x

   Non-authoritative answer:
   Name:    ads.citybeatmag.co
   Address: 76.76.19.89
   ```

**Or use online tools:**
- https://www.nslookup.io/?query=ads.citybeatmag.co
- https://dnschecker.org - Check multiple locations
- https://www.whatsmydns.net - Global propagation

---

## Step 7: Verify in Browser

Once DNS propagates (check in Step 6):

1. Open browser
2. Visit: `https://ads.citybeatmag.co/en/campaigns`
3. You should see:
   - ✅ Green padlock (HTTPS)
   - ✅ Campaign page loads
   - ✅ No error messages
   - ✅ Images and styling display

**If you get SSL error:**
- Wait another 5-10 minutes (certificate still provisioning)
- Refresh page
- Try different browser
- Check Vercel dashboard for errors

---

## Step 8: Test Each Campaign Page

Visit these URLs to verify everything works:

```
https://ads.citybeatmag.co/en/campaigns
https://ads.citybeatmag.co/en/newsletter
https://ads.citybeatmag.co/en/sponsored
https://ads.citybeatmag.co/en/banners
https://ads.citybeatmag.co/en/orders
https://ads.citybeatmag.co/en/success
```

All should load without errors.

---

## Optional: Add www Subdomain

If you want `www.ads.citybeatmag.co` to also work:

**Add another CNAME record:**
```
Type:     CNAME
Name:     www.ads
Value:    cname.vercel-dns.com
TTL:      3600
```

Or set up redirect from www to non-www.

---

## Optional: Add A Record for Root Domain

If you want bare `citybeatmag.co` (without `ads`) to point to ads portal:

**Check Vercel for current IP:**
1. Go to Vercel docs: https://vercel.com/docs/edge-network/regions-and-edge-functions
2. Look for current IP (usually `76.76.19.89` or similar)

**Add A record:**
```
Type:     A
Name:     @
Value:    76.76.19.89
TTL:      3600
```

⚠️ **WARNING:** This replaces your current root domain! Only do this if you want the root domain to point to Vercel.

---

## Troubleshooting

### Problem: "Connection Refused"
**Cause:** DNS not propagated yet
**Solution:** Wait 10-30 minutes and try again

### Problem: "ERR_NAME_NOT_RESOLVED"
**Cause:** DNS record not created or typo
**Solution:**
1. Go back to Hostgator DNS editor
2. Verify record exists:
   ```
   Type: CNAME
   Name: ads (NOT www.ads, NOT ads.citybeatmag.co)
   Value: cname.vercel-dns.com
   ```
3. Check spelling (case-insensitive but no spaces)
4. Save and wait 5 minutes
5. Try again

### Problem: "This site can't be reached"
**Cause:** CNAME record wrong or conflicting records
**Solution:**
1. Delete any A or AAAA records with name `ads`
2. Only keep the CNAME record for `ads`
3. Wait 10 minutes
4. Try again

### Problem: "SSL Certificate Error"
**Cause:** Certificate still provisioning
**Solution:**
1. Wait 5-10 more minutes (certificates take time)
2. Refresh page
3. Try different browser
4. Check Vercel dashboard for provisioning status

### Problem: "DNS doesn't resolve"
**Cause:** Hostgator nameservers not correct
**Solution:**
1. Check your Hostgator nameservers
2. They should be: `ns1.hostgator.com`, `ns2.hostgator.com`, etc.
3. If different, contact Hostgator support
4. Don't change unless told to do so

---

## DNS Record Reference

### Current Setup (after this guide)
```
Domain: citybeatmag.co
Subdomain: ads.citybeatmag.co

Type    Name    Value                    TTL
----    ----    -----                    ---
CNAME   ads     cname.vercel-dns.com     3600
A       @       192.168.1.1              3600 (your original root IP)
MX      @       mail.citybeatmag.co      3600 (keep for email)
TXT     @       v=spf1 ...               3600 (keep for email)
```

### If Moving Root Domain Too
```
Type    Name    Value                    TTL
----    ----    -----                    ---
A       @       76.76.19.89              3600 (Vercel IP)
CNAME   ads     cname.vercel-dns.com     3600
CNAME   www     cname.vercel-dns.com     3600
MX      @       mail.citybeatmag.co      3600
TXT     @       v=spf1 ...               3600
```

---

## Common DNS Record Types

| Type | Purpose | Example |
|------|---------|---------|
| A | Points to IP address | `192.168.1.1` |
| CNAME | Points to another domain | `cname.vercel-dns.com` |
| MX | Email server | `mail.example.com` |
| TXT | Text records (SPF, DKIM) | `v=spf1 include:sendgrid.net ~all` |
| NS | Nameserver | `ns1.hostgator.com` |
| SOA | Start of Authority | (Usually auto) |

---

## Useful Hostgator Support Resources

- **Hostgator Help:** https://support.hostgator.com/
- **DNS Help:** Search "DNS records" in Hostgator support
- **cPanel Help:** Search "cPanel" in Hostgator support
- **Contact Support:** https://support.hostgator.com/contact-us

**Hostgator support phone:** Check your Hostgator account email for support number

---

## Verification Checklist

- [ ] Logged into Hostgator
- [ ] Found DNS Zone Editor
- [ ] Added CNAME record for `ads`
- [ ] Value is `cname.vercel-dns.com`
- [ ] Saved the record
- [ ] Verified domain in Vercel
- [ ] Waited 10+ minutes for propagation
- [ ] Tested with nslookup or online tool
- [ ] Visited https://ads.citybeatmag.co in browser
- [ ] Page loads with HTTPS (green padlock)
- [ ] All campaign pages accessible
- [ ] No errors in browser console (F12)

---

## Next Steps

Once DNS is working:
1. Test Stripe integration with test cards
2. Configure email notifications
3. Set up monitoring and alerts
4. Test order workflows
5. Configure backup strategy

---

**Created:** 2026-02-05
**Status:** Ready for configuration
**Support:** Contact Hostgator if DNS issues persist
