const nodify = require('nodeify');
const fs = require('fs-extra');
const globParent = require('glob-parent');
const path = require('path');
const iconfont = require('./generator');
const hasha = require('hasha');

function IconfontPlugin(options = {}) {
  const required = ['svgs', 'fonts', 'styles'];

  for (let r of required) {
    if (!options[r]) {
      throw new Error(`Require '${r}' option`);
    }
  }

  this.options = Object.assign({}, options);
  this.fileDependencies = [];
  this.hashes = {};

  this.compile = this.compile.bind(this);
  this.watch = this.watch.bind(this);
}

IconfontPlugin.prototype.apply = function(compiler) {
  compiler.plugin('run', this.compile);
  compiler.plugin('watch-run', this.compile);
  compiler.plugin('after-emit', this.watch);
}

IconfontPlugin.prototype.compile = function(compilation, callback) {
  const { options } = this;
  return nodify(
    iconfont(options).then(result => {
        const { fontName } = result.config;
        let destStyles = null;

        if (result.styles) {
            destStyles = path.resolve(this.options.styles);
        }

        return Promise.all(
            Object.keys(result).map(type => {
                if (
                    type === 'config' ||
                    type === 'usedBuildInStylesTemplate'
                ) {
                    return Promise.resolve();
                }

                const content = result[type];
                const hash = hasha(content);
                let destFilename = null;

                if (type !== 'styles') {
                    destFilename = path.resolve(
                        path.join(this.options.fonts, `${fontName}.${type}`)
                    );
                } else {
                    destFilename = path.resolve(destStyles);
                }

                if (this.hashes[destFilename] !== hash) {
                  this.hashes[destFilename] = hash;
                  return new Promise((resolve, reject) => {
                    fs.outputFile(destFilename, content, error => {
                        if (error) {
                            return reject(new Error(error));
                        }
                        return resolve();
                    });
                  });
                }

            })
        );
    }),
    error => callback(error)
  );
}

IconfontPlugin.prototype.watch = function(compilation, callback) {
  const globPatterns = typeof this.options.svgs === 'string' ? [this.options.svgs] : this.options.svgs;

  globPatterns.forEach(globPattern => {
    const context = globParent(globPattern);
    if (compilation.contextDependencies.indexOf(context) === -1) {
      compilation.contextDependencies.push(context);
    }
  });

  return callback();
}

module.exports = IconfontPlugin;
