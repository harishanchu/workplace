# Workplace

Time sheet application for organizations.

## Installation

### Method 1

- Copy docker-compose.yml file to your workstation
- Go to terminal in the docker-compose file location and run `docker-compose up mysql adminer`
- Navigate to `http://localhost:8085/?server=mysql&username=root` in your browser.
- Login by providing password as `password`.
- Create database `workplace`.
- Head back to terminal and run docker-compose up.

### Method 2

- Install NodeJs(version >=8) in your workstation.
- Install mysql(mysql:5.7.21) server.
- Create database table `workplace`
- Clone the repository
- Modify [configuration](#configuration) files as needed.

After installation application can be accessed with url: `http://localhost:3000`.

When you start the application for the first time a default admin user is created with email: `workplace-admin@company.com` and password `password`. Default admin user email can set in the [configuration](#configuration) files and password is read from the environment variable `WORKPLACE_ADMIN_PASSWORD`. Remember this happens only on the first time, once you have an admin user created, changing admin email in te configuration files will not have any effect.

Admin users will have admin functionality enabled in the app.

## Configuration

- Application general configuration files can be found in `config` directory.
- Database and email connectivity configuration file is in path `server/datasources.json`

## Conventions

- When a time sheet is created an associated task is created for the time sheet.
- Open tasks can be referred in new time sheets.
- When a time sheet is marked as completed the associated task will be marked as closed.

