# Run the catalogue service on the AtomMan (WSL + Tailscale)

The catalogue service (wardrobe, outfit generation at any time, the 06:00 daily
pick) runs on the AtomMan mini PC instead of the Mac. The phone reaches it through
Tailscale, a private network, from home or away. Nothing is exposed to the
internet, so pairing (#20) can stay deferred.

```text
iPhone ──Tailscale──▶ AtomMan (Windows) ─▶ WSL Ubuntu ─▶ systemd: wist-catalogue
                                                           └─ node catalogue-service/dist/server.js :4000
                                                              (SQLite + photos in the repo folder)
```

## 1. Windows: keep the machine and WSL running

1. **Settings → System → Power → Screen and sleep**: set "When plugged in, put
   my device to sleep after" to **Never**. The schedulers only run while the
   machine is awake.
2. **Timezone**: **Settings → Time & language → Date & time**, set your own
   timezone. WSL follows it; the 06:00 pick uses this clock.
3. **Keep WSL alive**: create `C:\Users\<you>\.wslconfig` with:
   ```ini
   [wsl2]
   vmIdleTimeout=-1
   ```
   Then in PowerShell: `wsl --shutdown`.
4. **Start WSL at boot**: open **Task Scheduler → Create Task**:
   - General: "Run whether user is logged on or not".
   - Triggers: **At startup**.
   - Actions: Program `wsl.exe`, arguments `-d Ubuntu --exec /bin/true`.
   This starts the Ubuntu distribution, whose systemd then starts the service.

## 2. WSL: Node, the code and the secrets

In the Ubuntu terminal:

```bash
# systemd must be on (default on current WSL); check:
cat /etc/wsl.conf   # should contain [boot] systemd=true; add it and `wsl --shutdown` if not

# Node 22.5+ (node:sqlite needs it)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
node --version      # v22.5 or newer

git clone https://github.com/zhinoo-zobairi/wist.git ~/wist
cd ~/wist && npm install
```

Create `~/wist/.env.local` (never commit it):

```dotenv
CATALOGUE_OWNER_TOKEN=<64-char random value, same as on the Mac>
EXPO_PUBLIC_CATALOGUE_OWNER_TOKEN=<the same value>
CATALOGUE_HOST=0.0.0.0
ANTHROPIC_API_KEY=<your key>
```

Keep the code inside the Linux filesystem (`~/wist`), not under `/mnt/c`:
SQLite is slow and unreliable across the Windows mount.

## 3. WSL: run it as a service

```bash
npm run catalogue:build
sudo tee /etc/systemd/system/wist-catalogue.service >/dev/null <<EOF
[Unit]
Description=Wist catalogue service
After=network-online.target

[Service]
User=$USER
WorkingDirectory=$HOME/wist
ExecStart=/usr/bin/node --env-file-if-exists=.env.local catalogue-service/dist/server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now wist-catalogue
systemctl status wist-catalogue      # should say active (running)
journalctl -u wist-catalogue -f      # live logs
```

`Restart=on-failure` restarts it after a crash. Interrupted outfit runs are
marked failed at startup; the daily pick never repeats a paid call the same day.

## 4. Tailscale

1. Install Tailscale **inside WSL**:
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up        # opens a login link; sign in
   tailscale ip -4          # note this 100.x.y.z address
   ```
2. Install the **Tailscale** app on the iPhone and sign in with the same account.
3. Check from the iPhone's Safari: `http://100.x.y.z:4000/health` should
   answer. If it does, the phone can reach the server.

## 5. Point the app at the AtomMan

On the machine that runs Expo (`npm start`), set in `.env.local`:

```dotenv
EXPO_PUBLIC_CATALOGUE_URL=http://100.x.y.z:4000
```

Restart Expo so the new URL is bundled.

**Important:** with Expo Go, the app's code is served by `npm start` from your
Mac, so the Mac must still be on while you open the app. To use Wist with the
Mac off, either run `npm start` on the AtomMan as well (in WSL, and open
`exp://100.x.y.z:8081` in Expo Go), or make an installable build (#24, needs an
Apple Developer account).

## Updating

```bash
cd ~/wist && git pull && npm install && npm run catalogue:build
sudo systemctl restart wist-catalogue
```

## Backups

Everything lives in `~/wist/catalogue-service/data/`: the database
`wist.sqlite` and the `wardrobe-photos/` folder (`CATALOGUE_DB_PATH` moves both).
Until #22 adds backups, copy that folder somewhere safe after adding many pieces;
stop the service first (`sudo systemctl stop wist-catalogue`) so the copy is consistent.
