# 🚀 Production Deployment Guide - Hamropanchanga

## Pre-Deployment Checklist

- [x] Firebase project set to `hamropanchanga`
- [x] Admin user configured in Firestore
- [x] Debug logs removed
- [ ] Environment verified
- [ ] Functions deployed
- [ ] App built and deployed

---

## Step 1: Verify Firebase Project

```bash
# Check current project
firebase use

# Should show: hamropanchanga
# If not, switch to it:
firebase use hamropanchanga
```

---

## Step 2: Install Dependencies

```bash
# Install root dependencies
npm install

# Install functions dependencies
cd functions
npm install
cd ..
```

---

## Step 3: Deploy Cloud Functions (CRITICAL for Tithi Generator)

The `computeEphemeris` function is required for the Tithi auto-generator to work.

```bash
# Deploy only functions
firebase deploy --only functions

# Wait for deployment (this may take 2-5 minutes)
```

**Expected Output:**
```
✔  functions: Finished running predeploy script.
i  functions: preparing codebase default for deployment
i  functions: ensuring required API cloudfunctions.googleapis.com is enabled...
i  functions: ensuring required API cloudbuild.googleapis.com is enabled...
✔  functions: required API cloudfunctions.googleapis.com is enabled
✔  functions: required API cloudbuild.googleapis.com is enabled
...
✔  Deploy complete!
```

**Note:** If you see billing errors, you need to enable the Blaze plan (pay-as-you-go) for Cloud Functions.

---

## Step 4: Update Firestore Rules & Indexes

```bash
# Deploy firestore rules and indexes
firebase deploy --only firestore
```

---

## Step 5: Build React App for Production

```bash
# Build the React app
npm run build
```

**This creates an optimized production build in the `build/` folder.**

**Expected Output:**
```
Creating an optimized production build...
Compiled successfully.

File sizes after gzip:

  xxx KB  build/static/js/main.xxxxx.js
  xxx KB  build/static/css/main.xxxxx.css

The project was built assuming it is hosted at /.
The build folder is ready to be deployed.
```

---

## Step 6: Deploy to Firebase Hosting

```bash
# Deploy hosting (your React app)
firebase deploy --only hosting
```

**Expected Output:**
```
✔  hosting: Finished running predeploy script.
i  hosting[hamropanchanga]: beginning deploy...
i  hosting[hamropanchanga]: found xxx files in build
✔  hosting[hamropanchanga]: file upload complete
i  hosting[hamropanchanga]: finalizing version...
✔  hosting[hamropanchanga]: version finalized
i  hosting[hamropanchanga]: releasing new version...
✔  hosting[hamropanchanga]: release complete

✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/hamropanchanga/overview
Hosting URL: https://hamropanchanga.web.app
```

---

## Step 7: Deploy Everything at Once (Alternative)

Instead of deploying separately, you can deploy everything:

```bash
# Build first
npm run build

# Deploy everything
firebase deploy
```

---

## Post-Deployment Verification

### 1. Check Hosting URL
- Open: `https://hamropanchanga.web.app`
- Sign in with `kuinkelarun@gmail.com`
- Verify admin features show up

### 2. Test Tithi Generator
- Go to Admin Management → Tithis tab
- Try the "Generate Tithi by Date Range" feature
- Should work without `ERR_CONNECTION_REFUSED` errors

### 3. Check Functions Status
```bash
# List deployed functions
firebase functions:list
```

Should show:
- `computeEphemeris`
- `setAdminRole`
- `syncAuthUsersToFirestore`
- `computeTithi`

### 4. Monitor Functions Logs
```bash
# View real-time logs
firebase functions:log
```

---

## Troubleshooting

### Issue: Functions deployment fails with billing error

**Solution:** Enable Blaze plan (pay-as-you-go)
1. Go to Firebase Console → Upgrade
2. Enable Blaze plan
3. Set budget alerts (recommended: $10/month)
4. Re-run: `firebase deploy --only functions`

### Issue: Tithi generator still shows ERR_CONNECTION_REFUSED

**Causes:**
1. Functions not deployed
2. Still pointing to emulator

**Solution:**
1. Verify: `firebase functions:list` shows `computeEphemeris`
2. Check `src/firebase.js` - line 33 should only connect to emulator in development
3. Hard refresh browser (Ctrl+Shift+R)

### Issue: Build fails

**Solution:**
```bash
# Clear cache and rebuild
rm -rf node_modules build
npm install
npm run build
```

---

## Environment Variables (Optional)

If you need different configs for dev/prod, create:

`.env.production`
```
REACT_APP_FIREBASE_PROJECT_ID=hamropanchanga
REACT_APP_FIRESTORE_DATABASE_ID=hamropanchanga-db
```

---

## Quick Re-Deploy Script

After initial deployment, for quick updates:

```bash
# Build and deploy in one command
npm run build && firebase deploy --only hosting

# Or deploy functions + hosting
npm run build && firebase deploy --only functions,hosting
```

---

## Security Checklist

- [x] Firestore rules deployed
- [x] Storage rules deployed
- [x] Admin access limited to adminList users
- [ ] Review Firebase Console → Authentication → Users
- [ ] Remove any test/dummy accounts
- [ ] Verify `users/` collection has proper permissions

---

## Performance Optimization

After deployment:
1. Check Lighthouse score (in Chrome DevTools)
2. Enable Performance Monitoring in Firebase Console
3. Monitor Firestore usage and optimize queries if needed

---

## Backup Before Deployment

```bash
# Backup current Firestore data
firebase firestore:export gs://hamropanchanga.firebasestorage.app/backups/$(date +%Y-%m-%d)
```

---

## Rollback (If Issues)

```bash
# List hosting versions
firebase hosting:channel:list

# Rollback to previous version in Firebase Console
# Hosting → Release History → Rollback
```

---

## Support

If you encounter issues:
1. Check `firebase functions:log` for errors
2. Check browser console for client errors
3. Verify Firestore rules in Firebase Console
4. Check Firebase status: https://status.firebase.google.com

---

**Last Updated:** February 19, 2026
