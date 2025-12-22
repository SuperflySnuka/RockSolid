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


## Overview

RockSolid is a client-heavy web application built with HTML, CSS, and JavaScript.  
The frontend consumes data via Fetch API from both local JSON files and external APIs.  
A lightweight backend is used to proxy external services from tenor and integrate a Supabase database.

---

## Local Installation
After downloading the repo. it should run right away after activating a live server.


### Prerequisites
- Node.js (v18 or newer)
- Git
- A modern web browser

### Clone the Repository
```bash
git clone https://github.com/SuperflySnuka/RockSolid.git
cd RockSolid