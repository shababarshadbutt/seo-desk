FROM node:20-alpine

# Install Python3 and pip
RUN apk add --no-cache python3 py3-pip gcc musl-dev python3-dev

# Install Python packages
RUN pip3 install --break-system-packages \
    requests \
    cloudscraper \
    google-analytics-data \
    gspread \
    google-auth \
    pandas \
    oauth2client \
    lxml \
    google-api-python-client

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PYTHON_EXECUTABLE=python3

EXPOSE 3000

CMD ["npm", "start"]
