# Use a specific Node.js version as the base image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app/backend

# Copy package.json and package-lock.json (or yarn.lock) first to leverage Docker cache
# This layer only changes if dependencies change
COPY package.json ./
COPY yarn.lock ./ # If you are using yarn, otherwise remove this line

# Install dependencies. Use `npm ci` for clean install in CI/CD environments.
RUN npm install --frozen-lockfile # Or 'yarn install --frozen-lockfile' if using yarn

# Copy the rest of the application code
COPY . .

# Expose the port your Express app runs on (default 3001)
EXPOSE 3001

# Command to run the application
# Use 'npm start' as defined in your package.json, or 'node server.js'
CMD ["npm", "start"]