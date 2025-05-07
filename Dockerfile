FROM apify/actor-node:16

# Copy package.json and package-lock.json to the Docker image
COPY package.json ./

# Install NPM packages, skip optional and development dependencies to keep the image small
RUN npm --quiet set progress=false \
    && npm install --only=prod --no-optional \
    && echo "Installed NPM packages:" \
    && (npm list || true) \
    && echo "Node.js version:" \
    && node --version \
    && echo "NPM version:" \
    && npm --version

# Copy the rest of the application to the Docker image
COPY . ./

# Run the application when the container starts
CMD npm start
