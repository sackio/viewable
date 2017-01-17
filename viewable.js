var Async = require('async')
  , _ = require('underscore')
  , Belt = require('jsbelt')
  , Path = require('path')
  , FS = require('fs');

(function(){

  var Viewable = function(o){
    o = _.defaults(o || {}, {
      //paths
      'watch': true
    , 'locals': {}
    , 'js_locals': []
    });

    var self = this;

    self['views'] = {};
    self['templates'] = {};
    self['locals'] = o.locals;
    self['js_locals'] = o.js_locals;

    self['loadView'] = function(path, watch){
      var name = path.split(Path.sep).pop().replace(/\.(html|ejs)$/i, '');
      self.views[name] = FS.readFileSync(path).toString('utf8');
      self.templates[name] = _.template(self.views[name]);

      if (watch) FS.watch(path, {
        'persistent': false
      }, function(event, file){
        var n = path.split(Path.sep).pop().replace(/\.(html|ejs)$/i, '');
        self.loadView(path, self.views[n] ? false : watch);
      });
    };

    self['render'] = function(view, locals){
      var data = _.extend({}, {
        'Locals': _.extend({}, locals, self.locals)
      , 'Render': function(v, locs){
          locs = locs || data.Locals;
          locs['Render'] = locs.Render || data.Render;
          _.each(self.locations, function(v, k){
            locs[k] = locs[k] || data.Locals[k];
          });
          locs['Locals'] = locs;

          return self.templates[v](locs);
        }
      }, locals);

      return self.templates[view](data);
    };

    self['renderViewsJs'] = function(){
      var js = 'var Render = function(view, locals){\n'
             + '  locals = locals || window;\n';

      js += _.map(self.js_locals, function(l){
        return '  locals["' + l + '"] = locals[" + l + "] || l;';
      }).join('\n');

      js += '  locals.Render = locals.Render || Render;\n';

      js += '\n  return Templates[view](locals);\n'
          + '};\n'
          + '\n'
          + 'var Templates = {\n'

      var count = 0;
      js += _.map(self.views, function(v, k){
        return (count++ ? ',' : ' ') + ' "' + k + '": _.template(' + Belt.stringify(v.split(/\n+|\r+/)) + '.join("\\n"))\n';
      }).join('\n');

      js += '};';

      return js;
    };

    _.each(o.paths, function(p){
      var stat = FS.statSync(p)
        , paths = [];

      if (stat.isDirectory()){
        if (o.watch) FS.watch(p, {
          'persistent': false
        }, function(event, file){
          var n = file.split(Path.sep).pop();
          self.loadView(Path.join(p, Path.sep + file), self.views[n] ? false : o.watch);
        });

        _.chain(FS.readdirSync(p))
         .reject(function(p2){
           return FS.statSync(Path.join(p, '/' + p2)).isDirectory();
         })
         .each(function(p2){
            paths.push(Path.join(p, '/' + p2));
          });
      } else {
        paths.push(p);
      }

      _.each(paths, function(p2){
        self.loadView(p2, o.watch);
      });
    });

    return self;
  };

  module.exports = Viewable;

}.call());
