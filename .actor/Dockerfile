FROM apify/actor-node:20

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm --quiet set progress=false \
    && npm install --omit=dev --omit=optional \
    && echo "--- Checking for crawlee install ---" \
    && if [ -d "node_modules/crawlee" ]; then echo "FOUND node_modules/crawlee"; else echo "ERROR: node_modules/crawlee NOT FOUND after npm install"; exit 1; fi \
    && echo "--- Checking for apify install ---" \
    && if [ -d "node_modules/apify" ]; then echo "FOUND node_modules/apify"; else echo "ERROR: node_modules/apify NOT FOUND after npm install"; exit 1; fi \
    && npm list crawlee apify

# Copy the rest of the application
COPY . ./

# Run the build script to ensure email.js exists
RUN echo "Running build script to ensure email.js exists" \
    && ./build.sh \
    && echo "Verifying email.js exists" \
    && ls -la src/ \
    && if [ -f "src/email.js" ]; then echo "FOUND src/email.js"; else echo "ERROR: src/email.js NOT FOUND after build script"; exit 1; fi

# Run the actor
CMD ["node", "src/main.js"]
