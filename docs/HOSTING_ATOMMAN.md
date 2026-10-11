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

Everything lives in `~/wist/catalogue-service/data/`: the database `wist.sqlite`
and the `wardrobe-photos/` folder (`CATALOGUE_DB_PATH` moves both).

Every night at 04:30 (this machine's local time) a backup goes to a folder on the
Windows disk, `/mnt/c/WistBackups` (override with `CATALOGUE_BACKUP_DIR`). Each backup
is a folder named `YYYY-MM-DD-HHmm` holding `wist.sqlite` and `wardrobe-photos/`. The
database copy is made with SQLite `VACUUM INTO`, which gives a consistent snapshot
while the service keeps running, so nothing needs stopping. The folder is built under a
`.tmp-` name and renamed when complete, so a half-written backup is never counted.
The last 7 completed backups are kept; other files in the folder are never touched.

```bash
cd ~/wist && npm run catalogue:backup      # a backup right now
ls /mnt/c/WistBackups                      # or open C:\WistBackups in Windows
```

### Schedule it (systemd timer)

```bash
sudo tee /etc/systemd/system/wist-backup.service >/dev/null <<EOF
[Unit]
Description=Wist nightly backup

[Service]
Type=oneshot
User=$USER
WorkingDirectory=$HOME/wist
ExecStart=/usr/bin/node --env-file-if-exists=.env.local catalogue-service/dist/backup.js
EOF
sudo tee /etc/systemd/system/wist-backup.timer >/dev/null <<EOF
[Unit]
Description=Wist nightly backup at 04:30

[Timer]
OnCalendar=*-*-* 04:30:00
Persistent=true

[Install]
WantedBy=timers.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now wist-backup.timer
systemctl list-timers wist-backup.timer    # shows the next 04:30
```

`Persistent=true` runs the backup once after boot if the 04:30 run was missed while the
machine was off. After `git pull`, run `npm run catalogue:build` so the compiled backup is current.
A failed backup exits non-zero: `journalctl -u wist-backup` shows why, and
`systemctl status wist-backup` says `failed`.

### Restore

```bash
sudo systemctl stop wist-catalogue
cd ~/wist && npm run catalogue:restore -- /mnt/c/WistBackups/2026-10-11-0430
sudo systemctl start wist-catalogue
```

Restore replaces `wist.sqlite` and the whole `wardrobe-photos/` folder with the
backup's copies. It refuses to run while a `wist.sqlite-wal` file with content exists
(the service is still running or was killed uncleanly): stop the service first.

### Restore drill (prove a backup works, without touching live data)

Restores the newest backup into a throwaway folder and starts a second server on it.

```bash
cd ~/wist
NEWEST=$(ls -d /mnt/c/WistBackups/????-??-??-???? | sort | tail -1)
export CATALOGUE_DB_PATH=/tmp/wist-drill/wist.sqlite
npm run catalogue:restore -- "$NEWEST"
# second server on another port; empty API key, so it makes no paid calls
PORT=4010 ANTHROPIC_API_KEY= node --env-file-if-exists=.env.local catalogue-service/dist/server.js &
sleep 3
TOKEN=$(grep '^CATALOGUE_OWNER_TOKEN=' .env.local | cut -d= -f2)
curl -s localhost:4010/health                                          # health ok
curl -s -H "Authorization: Bearer $TOKEN" localhost:4010/v1/wardrobe   # lists your garments
ls /tmp/wist-drill/wardrobe-photos | head                              # photos are there
kill %1
rm -rf /tmp/wist-drill
unset CATALOGUE_DB_PATH
```

The drill passes when `/health` answers and `/v1/wardrobe` lists the garments you expect.
