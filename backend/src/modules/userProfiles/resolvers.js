const { User } = require('../../models');
const helpers = require('../auth/helpers');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  Query: {
    userProfile: async (parent, { id, username }) => {
      if (id) {
        return await User.findByPk(id);
      } else if (username) {
        return await User.findOne({ where: { username } });
      }
      throw new Error('Provide id or username');
    },
    searchUsers: async (parent, { query, limit }) => {
      return await User.findAll({
        where: {
          [Op.or]: [
            { username: { [Op.like]: `%${query}%` } },
            { email: { [Op.like]: `%${query}%` } }
          ]
        },
        limit
      });
    }
  },

  Mutation: {
    updateProfile: async (parent, { username, avatarUrl, bio, favouritePokemon }, context) => {
      if (!context.token) throw new Error('Not authenticated');
      const payload = helpers.verifyJwt(context.token.replace('Bearer ', ''));
      const user = await User.findByPk(payload.id);
      if (!user) throw new Error('User not found');
      if (username !== undefined) user.username = username;
      if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
      if (bio !== undefined) user.bio = bio;
      if (favouritePokemon !== undefined) user.favouritePokemon = favouritePokemon;
      await user.save();
      return user;
    },

    uploadAvatar: async (parent, { file }, context) => {
      if (!context.token) throw new Error('Not authenticated');
      const payload = helpers.verifyJwt(context.token.replace('Bearer ', ''));
      const user = await User.findByPk(payload.id);
      if (!user) throw new Error('User not found');

      // 1. Save the previous avatar URL for cleanup
      const prevAvatarUrl = user.avatarUrl;

      // 2. Get the file object, robust for various Apollo/Upload implementations
      let fileObj;
      if (typeof file.then === 'function') fileObj = await file;
      else if (file.promise) fileObj = await file.promise;
      else if (file.file) fileObj = file.file;
      else fileObj = file;

      if (!fileObj) throw new Error('No file received');
      const { createReadStream, filename, mimetype } = fileObj;

      console.log("Start avatar upload. Filename:", filename, "Mimetype:", mimetype);

      if (!filename) throw new Error("Filename is missing!");
      if (!mimetype.startsWith('image/')) throw new Error('Only image files allowed');

      // 3. Make a safe, unique filename (with username prefix)
      const safeUsername = user.username.replace(/[^a-zA-Z0-9_-]/g, '');
      const ext = path.extname(filename) || '.jpg';
      const uniqueName = `${safeUsername}-${uuidv4()}${ext}`;

      const uploadDir = path.join(__dirname, '../../../uploads/avatars');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log("Created uploadDir", uploadDir);
      }
      const filePath = path.join(uploadDir, uniqueName);

      await new Promise((resolve, reject) => {
        const stream = createReadStream();
        stream.on('error', (err) => {
          console.error('Stream error', err);
          reject(err);
        });
        const writeStream = fs.createWriteStream(filePath);
        writeStream.on('finish', () => {
          console.log('File saved to', filePath);
          resolve();
        });
        writeStream.on('error', (err) => {
          console.error('Write error', err);
          reject(err);
        });
        stream.pipe(writeStream);
      });

      // 4. Update user's avatar URL in the DB
      user.avatarUrl = `/uploads/avatars/${uniqueName}`;
      await user.save();

      // 5. IMMEDIATE CLEANUP LOGIC for old avatar
      if (
        prevAvatarUrl &&
        !prevAvatarUrl.startsWith('http') && // Don't try to unlink remote/placeholder images
        prevAvatarUrl !== user.avatarUrl     // Don't delete if it's the same file just uploaded
      ) {
        const prevPath = path.join(__dirname, '../../../', prevAvatarUrl);
        fs.unlink(prevPath, (err) => {
          if (err) console.warn('Old avatar not deleted (maybe already gone):', prevPath);
          else console.log('Deleted old avatar:', prevPath);
        });
      }

      console.log('Updated user avatar URL in DB:', user.avatarUrl);
      return user;
    }
  }
};
