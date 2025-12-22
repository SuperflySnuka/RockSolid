# RockSolid – Developer Manual
Whats not finished or not working...
1. Currently save data is handled via client side json files with a signiture.
    -This should be handled by supabase and handled by backend.
2. Tenor api calls are finicky so there is a fall back main stagged right now.
    -Keep working to make tenor permanently work.
3. Routine page needs more robustobility
    -Dragable skills, cleaner page navigation
4. single user model
    -Needs user authentification.

5. APIs supabase and tenor worked when hosted from client but not when pushed to production.

## Overview

RockSolid is a client-heavy web application built with HTML, CSS, and JavaScript.  
The frontend consumes data via Fetch API from both local JSON files and external APIs.  
A lightweight backend is used to proxy external services from tenor and integrate a Supabase database.

---

## Local Installation
After downloading the repo.
open the rootfolder and run



### Prerequisites
- Node.js (v18 or newer)
- Git
- A modern web browser
- fuse.js
- supabase

### Clone the Repository
```bash
git clone https://github.com/SuperflySnuka/RockSolid.git
cd RockSolid