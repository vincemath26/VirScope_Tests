# Welcome to VirScope!

Hi there and welcome to Vincent Marcus Bato Ramirez's 2025 Thesis Project!

## Background Context:

The onset of autoimmune diseases such as - Type 1 Diabetes (T1D) - have been theorised to be affected by viral infections. This has been supported through the usage of Phage ImmunoPrecipitation Sequencing (PhIP-Seq) methodology in which is a high throughput platform that enables sequencing and analysis of antigens that antibodies within a particular sample bind to. In this case, PhIP-Seq is used to monitor and identify what autoantibodies or immune responses to specific antigens within samples. VirScan is a method that uses the same PhIP-Seq protocols but relies on a phage library based on the human virome (a library that represents many known human viruses). However, VirScan outputs are hard to interpret and require a strong knowledge of data science methods to develop easily-understandable content.

## Thesis Project Recap:

As supplied by my university, my thesis project revolves around:

 *Creating reproducible and accessible history of viral infection reports using web-based approaches.*

To further break down this project, essentially I am tasked with deconvoluting pre-processed VirScan output into easily-understandable content such as graphs and/or bioinformatic maps (antigen maps, heatmaps, etc) and be able to display these contents through a web-based approach (in which I have chosen to do a simple web-application).

The main aims of the project are as follows:
| Criteria  | Description |
| ------------- |:-------------:|
| Accessibility |Create a satisfactory web-application with good user interface (UI) and user experience (UX) design principles in order to create a product that is web-based and hence accessible to many bioinformaticians.|
| Utility/usefulness|Improve the analysis of VirScan outputs by breaking down these pre-processed datasets and applying them to statistical methods as to turn them into more easily-understandable graphs; thus deconvoluting the whole process of generating a history of viral infections in individuals.|
| Security      |Contain private information of the datasets safe within this application (keeping patient sample data secure and inaccessible aside from the user who owns this data.)|

## Guide to my Repository

This repository contains everything technical-related that I've done for my project. As you can see from this initial file, there are two main folders present; The backend folder and the frontend folder.

The **backend** folder refers to my code environment that revolves around the server-side aspect of the web application. Within this folder contains all functions that relate to how the web application manages data (both user data and the datasets provided by users) as well as how they process these data models and manipulate them into visual content (graphs, maps, etc).
* An analogy that could be used to describe the backend is the "behind the scenes" part within a play.

The **frontend** folder refers to my code environment that creates what the user will interact with (the website/web application). This folder contains all components required to make the visual elements and user interface of the web application.
* Using the same analogy as before, the frontend can be used to describe the actors performing for the audience.

## Important Note

As I have just started working on my thesis project, I have not been able to deploy my backend and frontend online, thus testing my respository will require an extensive setup locally. Please refer to the steps below on how to properly setup my repository and test for yourself.

## Step 1: Cloning Repository

To copy this repository, please select the green code button and within the clone section, please select the SSH tab. Assuming that you are working in a machine that can handle gitbase commands within your terminal, you can do the following command:

`git clone [SSH]`

Then ensure that you move towards this new folder.

`cd [repository]`

For more information on how to setup git however, please refer to these links:
* [Basics of Git and How to Setup](https://docs.github.com/en/get-started/git-basics/set-up-git])
* [How to connect your GitHub with SSH](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)

## Step 2: Setting up the Backend

Before proceeding with the steps below, please ensure that you are working with the backend folder by doing the command `cd backend` on your terminal.

### Setting up the Database

I am using PostgreSQL, specifically this version:

```
psql (PostgreSQL) 17.5 (Ubuntu 17.5-1.pgdg20.04+1)
```

To setup the database, you must first install PostgreSQL into your system.
* [PostgreSQL Download](https://www.postgresql.org/download/)

After downloading, relaunch your codebase and ensure that PostgreSQL is downloaded successfully into your system by using this command into your terminal `psql --version`

Now that we have ensured that you have PostgreSQL installed, you then need to setup your environment variables. Copy the `.env.example` file and make your own `.env` using the following command `cp .env.example .env`

Now within this .env file, it should be in this format:

```
DATABASE_URL=postgresql://username:password@localhost/dbname
```

In order to change the values present within the DATABASE_URL, you must first setup your PostgreSQL User and Password then create a database. Do the following commands into your terminal:
```
# Note that for these commands, you only need to do them once.

`psql -U postgres`

`CREATE USER [yourusername] WITH PASSWORD '[yourpassword]'`

`ALTER ROLE [yourusername] CREATEDB`

`CREATE DATABASE [dbname]`

`GRANT ALL PRIVILEGES ON DATABASE [dbname] TO [yourusername]`

`\q`
```

Please remember what you put in for your `username` `password` and `dbname`

After changing your .env file with these values, you should be free to run this in your terminal to run a local PostgreSQL instance as to manage your database.

Linux/Mac:
```
# Always do this command before running the rest of the backend.
sudo service postgresql start
```

Windows:
* Go use an Ubuntu (WSL)Terminal OR
* Use PostgreSQL Tools or services panel to start PostgreSQL.

### Setting up Python Environment and Dependencies

I have used Python to develop most of my backend functions, specfically this version:

```
Python 3.13.5
```

To setup Python, ensure that you have it installed. If you don't please install it from this link and select this installation location as your interpreter for your code base (like Visual Studio).
* [Python Download](https://www.python.org/downloads/)

After downloading, relaunch your codebase and ensure that Python is downloaded successfully into your system by using this command into your terminal `python --version` or `py --version`

Now that we have ensured you have Python installed, it is recommended that you work by a Python virtual environment to manage dependencies for this project. You can do this by doing the following commands into your terminal.

```
# Note you only need to do this once
python -m venv venv

# If that didn't work try,
py -m venv venv
```

Then to launch your virtual environment, do the following command each time:

```
# On Windows:
venv\Scripts\activate
.\venv\Scripts\Activate.ps1

# On Linux/Mac:
source venv/bin/activate
```

Now, to download the necessary dependencies, please do the following command:

```
# You only need to do this once most likely. But in the case that I have updated the repository with a new function requiring a new dependency, please feel free to redownload the requirements.

pip install -r requirements.txt

```

To quit this virtual environment, please just do the following command on your terminal:

```
deactivate
```

### Setting up other aspects

Please also ensure that you download blastp diamond in your environment! Instructions are provided within this download link:

https://github.com/bbuchfink/diamond/releases

## Step 3: Setting up the Frontend

Before proceeding with the steps below, please ensure that you are working with the frontend folder by doing the command `cd frontend` on your terminal (assuming that you went back to the main folder from the backend folder by using `cd ..`)

## Running the frontend:

All you need to do is to just type in this command in your terminal:

```
npm install

npm start
```
