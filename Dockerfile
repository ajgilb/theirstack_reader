FROM apify/actor-node-puppeteer-chrome:20

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm --quiet set progress=false \
    && npm install --omit=dev --omit=optional \
    && echo "--- Checking for crawlee install ---" \
    && if [ -d "node_modules/crawlee" ]; then echo "FOUND node_modules/crawlee"; else echo "ERROR: node_modules/crawlee NOT FOUND after npm install"; exit 1; fi \
    && echo "--- Checking for apify install ---" \
    && if [ -d "node_modules/apify" ]; then echo "FOUND node_modules/apify"; else echo "ERROR: node_modules/apify NOT FOUND after npm install"; exit 1; fi \
    && echo "--- Installing Supabase client ---" \
    && npm install @supabase/supabase-js \
    && if [ -d "node_modules/@supabase/supabase-js" ]; then echo "FOUND node_modules/@supabase/supabase-js"; else echo "ERROR: node_modules/@supabase/supabase-js NOT FOUND after npm install"; exit 1; fi \
    && npm list crawlee apify @supabase/supabase-js

# Copy the rest of the application
COPY . ./

# Run the actor
CMD ["node", "src/main.js"]
