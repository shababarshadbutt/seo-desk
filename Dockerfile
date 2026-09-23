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

# V8's default heap ceiling (~2GB) was being hit well below what this host
# actually has free during a large Sitemap Cleaner run (confirmed via two
# production crashes, both landing at ~1.95GB with 2.6GB+ still available) —
# raise it so Node can actually use the host's headroom. Sized to this box's
# own 3.7GB total, not copied from a larger host; overridable via NODE_OPTIONS
# in the run/compose config without a rebuild if the host ever changes.
ENV NODE_OPTIONS="--max-old-space-size=3072"

EXPOSE 3000

CMD ["npm", "start"]
