# Put the WIST page online, on the AtomMan, under your own domain

This guide takes you from "no domain" to "the WIST page is online at your own
address". Every step says what it is for, what to type or click, and what you
should see. Plan about 45 minutes, plus waiting time for the domain.

## What you are building

```text
visitor's browser
      │  https://yourdomain.com
      ▼
Cloudflare  (owns the address, gives it HTTPS, forwards visitors)
      │  a "tunnel": a connection the AtomMan opens *outwards*, so no door in your router is opened
      ▼
AtomMan → Windows → WSL Ubuntu
      ├─ wist-site       127.0.0.1:8090  shows the files in ~/wist/site   ← the public page
      └─ wist-catalogue  127.0.0.1:4000  your private WIST data           ← NOT reachable through the tunnel
```

The private part of WIST (your catalogue, wardrobe, owner token) stays private
and is only reachable over Tailscale, exactly as before ([HOSTING_ATOMMAN.md](HOSTING_ATOMMAN.md)).

## Words used in this guide

| Word | What it means here |
|---|---|
| Domain | Your address on the internet, e.g. `wist.example`. You rent it per year. |
| Registrar | The shop where you rent the domain. Here: Cloudflare. |
| DNS | The internet's phone book: it tells browsers where your domain lives. Cloudflare runs it for you. |
| Tunnel | A program on the AtomMan (`cloudflared`) that connects out to Cloudflare and carries visitors in. |
| Caddy | A small web server. Here it only hands out the files of the page. |
| WSL / Ubuntu | The Linux that runs inside Windows on the AtomMan. You type the commands there. |
| systemd service | A program Linux starts by itself at boot and restarts if it crashes. |

## Checklist before you start

- [ ] A payment card (for the domain, roughly €10–15 a year for a `.com`).
- [ ] Access to the AtomMan (through the Windows App, as for the other AtomMan steps).
- [ ] The AtomMan setup steps 1 and 2 in [HOSTING_ATOMMAN.md](HOSTING_ATOMMAN.md) are done: Ubuntu starts at boot and the code is in `~/wist`.
- [ ] Your postal address for the Impressum (German law requires it on a business website). A business address service works if you don't want your home address online.

---

## Part A: Get your domain (on any computer, about 15 minutes)

### A1. Create a Cloudflare account

1. Open `https://dash.cloudflare.com/sign-up`.
2. Enter your email and a strong password, then **Create account**.
3. Open the email from Cloudflare and click the confirmation link.

**You should see:** the Cloudflare dashboard, with a menu on the left.

### A2. Choose a name

Tips for a good domain:
- short, easy to spell when you say it out loud, no hyphens;
- `.com` is the safest choice; `.app`, `.co` or `.fashion` also work, and some cost more;
- search for 2–3 options, because the first one is often taken.

### A3. Buy it

1. In the left menu: **Domain Registration → Register Domains**.
2. Type the name in the search box and press **Search**.
3. Pick an available result and click **Purchase** (or **Add to cart**, then **Checkout**).
4. Fill in the contact details. They must be real, because the registry checks them.
   Cloudflare hides them from the public "WHOIS" lookup automatically.
5. Leave **Auto-renew** on, so the domain doesn't expire after a year.
6. Pay.

**You should see:** the domain under **Domain Registration → Manage Domains**, with
status *Active* (this can take a few minutes). It also appears on your
account's home page, because Cloudflare already runs its DNS.

> **The name you want is not offered by Cloudflare** (some country endings, e.g.
> `.de`, may not be)? Buy it at another registrar, then:
> 1. In Cloudflare: **Add a domain** → type it → choose the **Free** plan.
> 2. Cloudflare shows two *nameservers* (names like `ada.ns.cloudflare.com`).
> 3. At the other registrar, find **Nameservers** for the domain, choose
>    "custom", and replace the existing ones with Cloudflare's two.
> 4. Wait until Cloudflare emails you that the domain is *active* (minutes to 24 hours).

### A4. Optional: an email address on your domain

So houses can write to `hello@yourdomain.com` instead of a Gmail address:

1. Click your domain → **Email → Email Routing** → **Get started**.
2. Custom address: `hello`, action **Send to an email**, destination your Gmail.
3. Confirm the email Cloudflare sends to your Gmail.
4. Click **Add records and enable** when asked.

**You should see:** an email sent to `hello@yourdomain.com` arrives in your Gmail.
Tell Claude the new address so the page and the email to houses can use it.

---

## Part B: Finish the legal pages (on the Mac)

The page links to an **Impressum** and a **privacy page (Datenschutz)**. They are
drafts with placeholders in square brackets:

| File | What to fill in |
|---|---|
| `site/impressum.html` | `[STRASSE UND HAUSNUMMER]`, `[PLZ ORT]`, `[TELEFON]` |
| `site/datenschutz.html` | `[STRASSE UND HAUSNUMMER]`, `[PLZ ORT]`, `[AUFSICHTSBEHÖRDE]` (the data protection authority of your federal state) |

The easiest way is to send the details to Claude, who fills them in and commits.
Have the privacy page checked by someone who knows German data protection law
before you rely on it. **Never put the page online while a `[` placeholder is still visible.**

Then the latest code must be on GitHub (`git push`), because the AtomMan
downloads it from there.

---

## Part C: On the AtomMan (about 25 minutes)

### C1. Open the Ubuntu terminal

On the AtomMan: **Start menu → type `Ubuntu` → open it**. A black window
with a prompt like `you@atomman:~$` appears. That's where you paste the
commands below.

- To **paste** in this window: right-click (or Ctrl+Shift+V).
- When a command asks for your **password** (`sudo`), type your Ubuntu
  password. You won't see the characters while you type; that's normal.
- Paste one grey block at a time and wait until the prompt `$` comes back.

### C2. Get the latest code

```bash
cd ~/wist && git pull
ls site
```

**You should see:** a list including `index.html`, `impressum.html`, `datenschutz.html`, `images`, `media`.

### C3. Tell the terminal your domain (type it once)

Replace `yourdomain.com` with your real domain, without `https://` and without `www`:

```bash
DOMAIN=yourdomain.com
echo "Domain is: $DOMAIN"
```

**You should see:** `Domain is: ` followed by your domain. If you close the
window later, run this block again before continuing.

### C4. Install and start the page server

This installs Caddy and creates the `wist-site` service, which shows only the
`site` folder and only on the AtomMan itself (`127.0.0.1`).

```bash
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
sudo apt-get update && sudo apt-get install -y caddy
sudo systemctl disable --now caddy   # the package's own Caddy is not used
```

```bash
sudo tee /etc/systemd/system/wist-site.service >/dev/null <<EOF
[Unit]
Description=WIST public page
After=network-online.target

[Service]
User=$USER
ExecStart=/usr/bin/caddy file-server --root $HOME/wist/site --listen 127.0.0.1:8090
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now wist-site
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8090/
```

**You should see:** `200` on the last line. (Caddy keeps no visitor log, which
the privacy page relies on.)

### C5. Install the tunnel program

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list >/dev/null
sudo apt-get update && sudo apt-get install -y cloudflared
cloudflared --version
```

**You should see:** `cloudflared version …`.

### C6. Connect the AtomMan to your Cloudflare account

```bash
cloudflared tunnel login
```

It prints a long link. Copy it into a browser on the AtomMan (or any
computer), sign in to Cloudflare, click your domain, then **Authorize**.

**You should see** in the terminal: `You have successfully logged in`.

### C7. Create the tunnel and point your domain at it

```bash
cloudflared tunnel create wist-site
TUNNEL_ID=$(basename ~/.cloudflared/*-*-*-*-*.json .json)
echo "Tunnel is: $TUNNEL_ID"
cloudflared tunnel route dns wist-site "$DOMAIN"
cloudflared tunnel route dns wist-site "www.$DOMAIN"
```

**You should see:** `Tunnel is: ` followed by a long ID, and two lines saying a
DNS record was added. In the Cloudflare dashboard, your domain → **DNS** now
lists two `CNAME` records pointing at `…cfargotunnel.com`.

### C8. Tell the tunnel what to show, and start it

```bash
sudo mkdir -p /etc/cloudflared
sudo cp ~/.cloudflared/"$TUNNEL_ID".json /etc/cloudflared/
sudo tee /etc/cloudflared/config.yml >/dev/null <<EOF
tunnel: $TUNNEL_ID
credentials-file: /etc/cloudflared/$TUNNEL_ID.json
ingress:
  - hostname: $DOMAIN
    service: http://127.0.0.1:8090
  - hostname: www.$DOMAIN
    service: http://127.0.0.1:8090
  - service: http_status:404
EOF
cat /etc/cloudflared/config.yml
sudo cloudflared --config /etc/cloudflared/config.yml tunnel ingress validate
sudo cloudflared service install
sudo systemctl enable --now cloudflared
systemctl is-active cloudflared
```

**You should see:** the config printed with your domain and ID, then `OK`, then `active`.

Why this is safe: the config only sends your domain to port 8090 (the page).
Everything else gets "404 not found". There is no line for port 4000, so your
private catalogue can't be reached from the internet. The `.json` file is the
tunnel's secret: never share or commit it.

### C9. Always use HTTPS

In the Cloudflare dashboard: your domain → **SSL/TLS → Edge Certificates** →
switch **Always Use HTTPS** on.

---

## Part D: Check it (2 minutes)

Use your phone **on mobile data, not the home Wi-Fi**, so you test it the way
visitors see it:

| Open | You should see |
|---|---|
| `https://yourdomain.com` | The WIST page, photos shown, clips playing |
| `https://www.yourdomain.com` | The same page |
| `https://yourdomain.com/impressum.html` | Your Impressum, with no `[` placeholders |
| `https://yourdomain.com/v1/brands` | A 404 error. Good: the private catalogue is not reachable |

## When something goes wrong

| What you see | Likely cause | Fix |
|---|---|---|
| The domain doesn't open at all (DNS error) | The domain is new or nameservers just changed | Wait up to an hour (with another registrar, up to 24 hours), then try again |
| Cloudflare page "Error 1033" | The tunnel isn't running | `sudo systemctl restart cloudflared`, then `systemctl status cloudflared` |
| "502 Bad Gateway" | The page server isn't running | `sudo systemctl restart wist-site`, then `curl -I http://127.0.0.1:8090/` should say `200` |
| The page shows but photos or clips are missing | `git pull` wasn't run after the latest push | `cd ~/wist && git pull` |
| `tunnel login` link doesn't open | It was opened in the wrong browser or timed out | Run `cloudflared tunnel login` again and open the new link |
| `Tunnel is:` shows something odd | More than one tunnel file exists | `ls ~/.cloudflared/` and use the ID of `wist-site` (`cloudflared tunnel list`) |
| Everything stopped after a Windows restart | WSL didn't start at boot | Check step 1.4 in [HOSTING_ATOMMAN.md](HOSTING_ATOMMAN.md) (Task Scheduler) |

## Updating the page later

On the Mac, changes to `site/` are committed and pushed. Then on the AtomMan:

```bash
cd ~/wist && git pull
```

The page is updated at once; nothing needs restarting.

## Turning it off

```bash
sudo systemctl disable --now cloudflared wist-site
```

Your domain then shows a Cloudflare error page; the private WIST keeps running.

## Decisions behind this setup (approved 2026-11-01)

| | Decision |
|---|---|
| H1 | Caddy serves only `~/wist/site` on `127.0.0.1:8090`, as its own service `wist-site`, without an access log. |
| H2 | `cloudflared` sends only the domain and `www.` to port 8090; everything else gets 404. Port 4000 is never in the tunnel. |
| H3 | No port forwarding on the router, no Tailscale Funnel. |
| H4 | `git pull` updates the page at once; no restart. |
| H5 | The domain is bought through Cloudflare Registrar; email forwarding is optional and free. |
| H6 | The page is offline whenever the AtomMan, WSL or the home internet is down. |
