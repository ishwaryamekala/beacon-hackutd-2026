# Supabase setup (first time, macOS)

Supabase is the shared database. The website and Beau (the iMessage agent) both
read and write the same `reports` table, which is why a text sent to Beau shows
up on the web map live. You only do this once.

**Never paste your keys into chat, a screenshot, a GitHub issue, or a slide.**

---

## 1. Create an account

1. Go to https://supabase.com and click **Start your project**.
2. Sign in with **GitHub**.

## 2. Create the project

1. Click **New project**.
2. **Name:** `beacon`
3. **Database password:** click generate, or type your own. **Save it in a password
   manager now.** You will not be shown it again.
4. **Region:** pick the closest one to Texas, such as **East US (North Virginia)**
   or **Central US** if it is listed.
5. **Plan:** Free.
6. Click **Create new project** and wait about 2 minutes until the dashboard loads.

## 3. Create the tables

1. In the left sidebar, click **SQL Editor**.
2. Click **+ New query**.
3. Open `supabase/schema.sql` from the beacon folder in any text editor, select
   all of it (Cmd+A), and copy it (Cmd+C).
4. Paste it into the SQL editor (Cmd+V).
5. Click **Run** (bottom right).
6. You should see: **Success. No rows returned**

If you see a red error, copy the message and ask in the team channel. Do not edit
the SQL yourself. The file is safe to run again if you need to retry.

## 4. Copy your URL and public key

1. Click the **gear icon** (Project Settings) at the bottom of the left sidebar.
2. Click **API** (it may be called **Data API** or **API Keys** in newer dashboards).
3. Copy two values:
   - **Project URL**, which looks like `https://abcd1234.supabase.co`
   - **anon / publishable** key, the long one labelled `anon` or `publishable`

**Do NOT use the `service_role` or `secret` key.** It bypasses all security. It
must never go into a `VITE_` variable, because anything with `VITE_` in the name
is shipped to every browser that opens the site.

## 5. Put the keys in `.env`

1. Open Terminal and go to the beacon folder:

   ```bash
   cd "/Users/ishwaryamekala/Desktop/claude code/beacon"
   ```

2. If there is no `.env` file yet, make one from the template:

   ```bash
   cp .env.example .env
   ```

3. Open it in TextEdit:

   ```bash
   open -e .env
   ```

4. Fill in the two Supabase lines, pasting the values you copied in step 4:

   ```
   VITE_SUPABASE_URL=https://abcd1234.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key-here
   ```

5. Save with Cmd+S and close the window.

Leave the other lines (NVIDIA, Photon) alone unless you have those keys.

## 6. Restart the dev server

The dev server only reads `.env` when it starts. The team lead will restart it.
When it comes back, look at the web header: the status pill should change from
**○ demo data** to **● live**.

If it still says demo data, check that there are no typos or extra spaces in
`.env`, and that the URL starts with `https://`.

## 7. Quick check

1. In Supabase, click **Table Editor** in the left sidebar.
2. Click **reports**. It should be empty.
3. Back on the Beacon website, open the **Report** tab and submit an obstacle.
4. Go back to the Table Editor and click **reports** again (or leave it open and
   watch). The new row appears with `source = web`.

If the row appears, the website is connected to the database. Beau's texts will
land in the same table.

---

## Troubleshooting

| What you see | What to do |
|---|---|
| Pill says **○ demo data** after restart | Check `.env` spelling and that the dev server was restarted |
| Report submits but no row appears | Check that step 3 said "Success", then re-run the SQL |
| Red "row-level security" error in the browser console | Re-run `supabase/schema.sql` in full |
| Lost the database password | It does not matter for the website. Only the anon key is needed. |
