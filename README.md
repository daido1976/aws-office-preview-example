## Overview

This repository provides an example implementation of a scalable office file preview feature running on AWS. It consists of the following components:

- A single-page application (SPA) web application that allows users to upload and preview files.
- A Lambda function that converts office files to PDF format.
- An S3 bucket for storing files.

Currently, only local environment execution is supported.

## How to Run in Local Environment

### Prerequisites

- Docker
- Node.js

### Steps

1. Clone this repository:

```sh
$ git clone <repository-url>
$ cd <repository-directory>
```

2. Start the necessary services using Docker Compose:

```sh
$ docker compose up -d
```

3. Navigate to the `web` directory, install dependencies, and start the web application:

```sh
$ (cd web && npm i -ws && npm run build -w client && npm run start -w server)
```

4. Open your browser and access the application at [http://localhost:3000](http://localhost:3000).

You can verify functionality by uploading an office file and observing the preview output.
