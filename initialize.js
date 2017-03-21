/**
* PEPPER ROLES - SPICEWORKS PLUGIN
* @author Michael Maw (jMichael)
* @website https://www.michaelmaw.com/apps/pepper-roles
* @version 1.8
* @date 2016-05-19
*/

/** CONFIGURATION PANEL SETTINGS */

plugin.configure({
  settingDefinitions:[
    { name:'data', label:'Data:', type:'text', defaultValue:'' },
    { name:'users', label:'Users:', type:'text', defaultValue:'' },
    { name:'hash', label:'Hash:', type:'text', defaultValue:'' }
  ]
});

/** GLOBAL VARIABLES */

var PR;

/** LOAD CSS STYLESHEET */

plugin.includeStyles();

/** PEPPER ROLES NAMESPACE */
  
!function($) {
  
  PR = {
    
    // Set to true to turn on console debugging
    debug: false,

    // Plugin version
    version: 1.8,
    
    // Permissions data placeholder
    data: [],
    
    // Permissions paths placeholder
    paths: [],
        
    // Permission Options (includes backwards-compatible paths)
    permissions: {
      "Dashboard": "dashboard",
      "Help Desk": {
        "Dashboard": "ticket_dashboard", 
        "Knowledge Base": "knowledge_base", 
        "Tickets": "tickets||tickets/.*"
      },
      "Inventory": {
        "Cloud Services": "cloud_services",
        "Devices": "inventory||inventory/devices.*",
        "Mobile Devices": "mdm",
        "My Tools": "my_tools",
        "Network Map": "inventory/map",
        "People": "people",
        "Scan": "scan",
        "Software": "software||inventory/software.*",
        "Troubleshooting": "troubleshooting.*"
      },
      "Purchasing": {
        "Purchase List": "purchases",
        "Vendors": "agreements"
      },
      "Reports": "reports",
      "Settings": {
        "Global Settings": {
          "My Account": "settings/my-account",
          "Backup Configuration": "settings/backup||settings/data-backups",
          "International Options": "settings/international-options",
          "Timeline Setup": "settings/timeline||settings/timeline-setup",
          "Purchases": "settings/purchases||settings/v1/purchases.*",
          "Proxy Settings": "settings/proxy-settings",
          "Advanced Options": "settings/advanced.*"
        },
        "Help Desk": {
          "Active Directory": "settings/active_directory||settings/helpdesk/active-directory",
          "Advanced Settings": "settings/help_desk||settings/helpdesk/advanced-settings",
          "Custom Attributes": "settings/advanced||settings/helpdesk/customize-attributes",
          "Email Settings": "settings/email||settings/helpdesk/email",
          "Monitors & Alerts": "settings/monitors||settings/advanced/external_alerts||settings/helpdesk/monitors-and-alerts",
          "Notifications": "settings/help_desk||settings/helpdesk/notifications",
          "Portal": "settings/help_desk||settings/helpdesk/portal",
          "User Accounts": "settings/users||settings/helpdesk/user-accounts"
        },
        "Inventory": {
          "Active Directory": "settings/active_directory||settings/inventory/active-directory",
          "Cloud Services": "settings/cloud_services||settings/inventory/cloud-services",
          "Custom Attributes": "settings/advanced||settings/inventory/customize-attributes",
          "Custom Groups": "settings/categories||settings/inventory/custom-groups",
          "Device Scanning": "settings/network||settings/events||settings/inventory/device-scanning",
          "Email Settings": "settings/email||settings/inventory/email",
          "Monitors & Alerts": "settings/monitors||settings/advanced/external_alerts||settings/inventory/monitors-and-alerts",
          "Remote Sites & Agents": "settings/remote_sites||settings/inventory/remote-sites-and-agents",
          "User Accounts": "settings/users||settings/inventory/user-accounts"
        },
        "Manage Apps": "settings/apps||settings/plugins",
        "ManageEngine": "settings/app-center/manage-engine"
      },
      "User Portal": { 
        "Manage": "portal:manage||user_portal.*",
        "View" : "portal:view"
      }
    },

    // Display debug messages in console
    dbg: function(msg) {
      if (PR.debug && console) { console.log("[pepper-roles] " + msg); }
    },
    
    // Execute a callback function when a DOM object finishes loading
    ready: function(obj, callback) {
      setTimeout(function() {         
        if ($(obj).length) { callback(); }
        else { 
          PR.ready(obj, callback);
        }
      }, 10);
    },
    
    // Plugin init
    init: function() {

      if (PR.matchURL('/portal')) { PR.portal(); }
      
      /** EVENT HANDLERS */
      
      if (SPICEWORKS.app.user && SPICEWORKS.app.user.role === 'admin') {
        
        PR.dbg("Init");
        
        // Load plugin data
        PR.data = plugin.settings.data;
        PR.data = (PR.data === '[]' || !PR.data) ? [] : $.parseJSON(PR.data);
    
        // Global Events
        $('body').on('click', '#pr-modal-override :checkbox', function() {
          $(this).parent().next().toggle();
        });

        // CONVERT PERMISSION PATHS INTO AN ARRAY
        PR.getPaths(PR.permissions);
        
        // CHECK PERMISSIONS
        PR.access();
        
        // CHECK PERMISSIONS ON HYPERLINKS
        if (PR.matchURL('/settings')) {
          
          // EVENT: Plugin list refreshed
          SPICEWORKS.observe("plugin:componentRendered", function() {
            if (PR.matchURL('/settings/apps')) {
              PR.settings.app = $('.sw-app-name:contains("Pepper Roles")').closest('.sw-app-row');
              PR.settings.init();
            }
          });
          
          // Wait for Settings page navigation to load
          PR.ready('.settings-vertical-nav .ember-view.panel', function() {
            PR.hyperlinks();
          });
          
        } else { 
          
          // Hijack ALL hyperlinks
          PR.hyperlinks();
        }
        
        // SETTINGS PAGE LOADED
        PR.settings.loaded();
      }
      
    },
    
    // Process hyperlink events
    hyperlinks: function() {     
      $('a[href],.settings-vertical-nav .ember-view.panel').on('mousedown click', function(e) {
        var path = $(this).attr('href') || '';

        // Ignore links with JavaScript code
        if (path.indexOf('javascript') !== -1) { return; }
        
        // Handle non-hyperlinks
        if (!path) {
          path = $(this).find('header h4').text();
          path = (path === 'Manage Apps') ? '/settings/apps' : path;
          path = (path === 'ManageEngine') ? '/settings/app-center/manage-engine' : path;
          PR.dbg(path);
        } else if (e.type === 'mousedown') {
          
          // Only process mousedown events on non-hyperlinks
          return;
        }

        // Check access
        if (!PR.access(true, path)) {
          e.stopImmediatePropagation();
          
          // Click "body" to close any open menus
          if (e.type === 'click') { $('body').click(); }
          
          PR.err('You do not have access to this module:', path);
          return false;
        }
        
        // SETTINGS >> APPS Loaded
        if (path.indexOf('/settings') !== -1) {
          PR.settings.loaded(path);
        }
      });
    },
    
    // Init plugin on the portal
    portal: function() {
      if (plugin.settings.users) {
        
        var users = plugin.settings.users.split(',');
        var email = $('#header .logged-in strong').text();
        
        if (email) {
          $.each(users, function() {
            PR.dbg(this);
            var user = this.split(':');
            if (user[1] === email) {
              
              // HACK: SPICEWORKS.app.user is not available in the portal, so create it from scratch
              SPICEWORKS.app.user = {
                id: user[0],
                email: email,
                role: 'admin' 
              };
            }
          });
        }
      }
    },

    // Upgrade permissions (for compatibility)
    upgrade: function(perms) {
      PR.dbg('Upgrading permissions');
      var list = [];
      $.each(perms, function() {
        var old = (this.indexOf('||') === -1) ? [ this.toString() ] : this.split('||');
        $.each(old, function() {
          var path = this.toString();
          $.each(PR.paths, function() {
            var paths = (this.indexOf('||') === -1) ? [ this.toString() ] : this.split('||');
            if ($.inArray(path, paths) !== -1 && $.inArray(this.toString(), list) === -1) {
              list.push(this.toString());
            }
          });
        });
      });
      return list;
    },
    
    // Convert PR.permissions to an array of unique paths
    getPaths: function(paths) {
      $.each(paths, function(n,v) {
        if (typeof v === 'string') {         
            if ($.inArray(v, PR.paths) === -1) { PR.paths.push(v.toString()); }
        } else {
          PR.getPaths(v);
        }
      });
    },
    
    // Confirm access to current resource
    access: function(checkonly, path) {
      var userid = SPICEWORKS.app.user.id.toString();
      var allow = false;
      
      // If no permissions set, allow full access
      if (PR.data.length === 0) { return true; }
      
      // Check for passcode hash in querystring
      var qs = location.search.replace('?', '');
      if (qs) {
        var hash = '';
        if (qs.indexOf('pr-hash') !== -1) { hash = qs.replace('pr-hash=', ''); }
        if (hash === plugin.settings.hash || (hash === 'override' && !plugin.settings.hash)) { return true; }
      }
      
      // Parse URL
      path = path || location.pathname;
      if (path.indexOf('?') !== -1) { path = path.split('?')[0]; }
      if (path.indexOf('/') === 0) { path = path.substring(1); }
      if (path.lastIndexOf('/') === path.length - 1) { path = path.substr(0, path.length - 1); }
      
      PR.dbg('Path = ' + path);
      
      var unknown = true, matched = false, actions = [];
      
      $.each(PR.paths, function() {
        var mperm = this.toString();
        var paths = (this.indexOf('||') === -1) ? [ this.toString() ] : this.split('||');
        
        // Cycle through each path
        $.each(paths, function() {
          var perm = this.toString();
          
          // Exact match
          if (perm === path) { matched = true; }
          else if (perm.indexOf('.*') !== -1) { 
            // Wildcard match
            if (path.indexOf(perm.split('.*')[0].toString()) !== -1) { matched = true; } 
          } else if (perm.indexOf(':') !== -1) { 
            // Remove "actions" (ie. ":view") and match against it
            if (perm.split(':')[0].toString() === path) { 
              matched = true;
            } 
          }
          
          // Match found!
          if (matched) {
            
            PR.dbg('Path recognized');
            
            // Check against group permissions
            $.each(PR.data, function() {
              if ($.inArray(userid, this.members) !== -1) {
                var permissions = PR.upgrade(this.permissions);
                
                // Does the user have access to this path?
                if ($.inArray(mperm, permissions) !== -1) { 
                  PR.dbg("Allow access");
                  if (perm.indexOf(':') !== -1) { actions.push(perm); }
                  allow = true;
                  return false;
                }
              }
            });
            
            unknown = false;
          }
          
          // Reset
          matched = false;
        });
      });
      
      // Allow access to unknown paths (ie. other apps, etc.)
      if (unknown) { 
        PR.dbg("Unknown path detected - allowing access");
        return true;
      }

      if (checkonly) {
        return allow;
      }
      
      // Check for "actions" (ie. ":view", ":manage")
      if (actions.length) {
        PR.dbg('Actions: ' + actions.toString());
        PR.restrict(actions);
      }

      // Display error message
      if (!allow) {
        if (path === "portal") { 
          $('#admin-bar').html('<h3 style="color:white; text-align:center;">User Portal</h3>');
        }

        $('#container').empty();
        PR.err('You do not have access to this module:', path);
      }
    },
    
    // Restrict access to certain parts within a module
    restrict: function(actions) {
      
      $.each(actions, function() {
        switch(this.toString()) {
          case 'portal:view':
            // Remove admin components from User Portal
            if ($.inArray('portal:manage', actions) === -1) {
              $('.admin-actions').remove();
            }
            break;
        }
      });
      
    },

    // Match URL
    matchURL: function(path) {     
      return (location.href.indexOf(path) !== -1);
    },

    // Show error message
    err: function(msg, path) { 
      var ao = (path) ? '<div id="pr-modal-override"><div id="pr-modal-path">' + path + '</div><div><input type="checkbox" /> <label>Admin Override?</label></div><div style="display:none;"><label>Enter Passcode:</label> &nbsp; <input type="password" /><div id="pr-modal-err"></div></div></div>' : '';
      $('<div id="pr-modal"><h1>Pepper Roles</h1><div>' + msg + '</div>' + ao + '<div id="pr-modal-footer"><button id="pr-modal-btn" type="button">Ok</button></div></div><div id="pr-modal-overlay"></div>').prependTo('body');
      $('#pr-modal-btn').on('click', function() {
        if (path && $('#pr-modal-override :checkbox').is(':checked')) { PR.override.validate(path); }
        else { $('#pr-modal,#pr-modal-overlay').remove(); }
      });
    },
    
    // Sort a list of options
    sort: function(list) {
      if (!list) { return; }
      list = (list.indexOf(',') !== -1) ? list.split(',') : [ list ];
      for (var l = 0; l < list.length; l++) {
        var opts = $(list[l]).children().sort(function(a, b) { 
          a = $(a).text();
          b = $(b).text();
          return (a < b) ? -1 : (a > b) ? 1 : 0;
        });
        $(list[l]).html(opts);
      }
    },
    
    // ------------------------------------------------------------------------
    
    /** ADMIN OVERRIDE */
    
    override: {
      
      // Validate passcode
      validate: function(path) {
        
        PR.dbg('Admin Override Validation --> ' + path);
        
        var result = '', pwd = $('#pr-modal-override :password').val();

        if (!path || !pwd) { result = 'Passcode cannot be empty'; }
        else if (!plugin.settings.hash && pwd === 'override') { PR.override.accept(path); return; }
        else if (PR.override.hash(pwd) !== plugin.settings.hash) { result = 'Passcode incorrect'; }
        else { PR.override.accept(path); return; }
        
        $('#pr-modal-err').text(result);
      },
      
      // Accept override
      accept: function(path) {
        window.location = ((path[0] !== '/') ? '/' : '') + path + '?pr-hash=' + (!plugin.settings.hash ? 'override': plugin.settings.hash);
      },
      
      // Hash passcode
      hash: function(pwd) {
        if (!pwd) { return ''; }
        var hash = 0;
        for (var c = 0; c < pwd.length; c++) {
          hash += (pwd.charCodeAt(c) * pwd.charCodeAt(pwd.length - 1) * ((c + 1) * 91101010911));
        }
        return hash.toString();
      }
    },
    
    // ------------------------------------------------------------------------
    
    /** SETTINGS */
    
    settings: {
      
      // App placeholder
      app: null,
      
      // Event handler to fire when the Settings page has loaded
      loaded: function(path) {

        PR.dbg('PR.settings.loaded');
        
        // SETTINGS >> USERS Loaded
        if (PR.matchURL('/settings/users') || PR.matchURL('/user-accounts') || $.inArray(path, ['/settings/users','/settings/helpdesk/user-accounts','/settings/inventory/user-accounts']) !== -1) {
          var msg = 'You have the "Pepper Roles" plugin installed. All users below must be assigned to the "Admin" role first before this plugin will take effect. Then go to Settings &gt;&gt; Manage Apps and click Configure on the Pepper Roles plugin to configure advanced permissions &amp; access levels.';
          PR.ready('.user-accounts-table', function() {
            if (!$('message-panel.pr').length) {
              $('.user-accounts-table').before('<message-panel class="pr message-panel--info"><span class="message">' + msg + '</span></message-panel>');
            }
          });
        }
      },
      
      // Init plugin settings
      init: function() {

        if (PR.settings.app.hasClass('pr')) { return; }
        
        PR.dbg('Settings Init');
        
        // Get app listing
        PR.settings.app.addClass('pr') ;
        
        // Show app logo (override default icon)
        var logo = PR.settings.app.find('.sw-app-icon > img');
        logo.attr('src', plugin.contentUrl('logo.png'));
        
        // Get Admin users
        SPICEWORKS.data.query({ 'data': { 'class': 'User', 'conditions': 'role="admin"' }}, function(users) {
          PR.users = users.data;
        });
        
        // EVENT: Show plugin settings
        var configLink = PR.settings.app.find('.sw-app-configure-link');
        configLink.on('mouseup', function() {
          if (!PR.settings.app.find('.plugin-configure').length) {
            PR.ready('.pr .plugin-configure > form', function() {         
              PR.settings.form = PR.settings.app.find('.plugin-configure > form');
              PR.settings.load(PR.settings.form);
            });
          }
        });
        
        // EVENT: Settings events
        PR.settings.app.on('click', 'button.pr-group-add', function() {
          PR.settings.group.add();
        }).on('click', 'button.pr-group-save', function() {
          PR.settings.group.save();
        }).on('click', 'button.pr-group-del', function() {
          PR.settings.group.del();
        }).on('change keyup', 'select.pr-groups', function() {
          PR.settings.group.edit($(this).val());
        }).on('click', 'button.pr-member-add', function() {
          PR.settings.group.member.add($(this).prev());
        }).on('click', 'button.pr-member-del', function() {
          PR.settings.group.member.del();
        }).on('change', '#PR :checkbox', function() {
          PR.settings.group.permission.save($(this));
        }).on('click', '.pr-access a', function() {
          $(this).next().toggle();
        });
      },
      
      // Load the configuration form
      load: function(f) {         
        if ($('#PR').length) { return; }
        
        $('<div id="PR"></div>').insertBefore(f.find('div:last'));
        
        // Load configuration options
        plugin.renderHtmlTemplate('settings.html', {}, function(content) {
          f = $('#PR');
          f.html(content);
          
          // Adjust blue marker height
          $('#sw-app-row-marker').animate({ height: $('.pr').height() - 5 }, 250);
          
          // Populate permission options list
          PR.settings.permissions(PR.settings.form.find('.pr-access'), PR.permissions);
          
          // Get data
          var data = PR.settings.form.find('div.setting input[name^="data"]').val();

          PR.data = (!data) ? [] : $.parseJSON(data);

          PR.dbg(JSON.stringify(PR.data).replace(/\\/gi, ''));
          
          // Populate groups
          PR.settings.group.list();
          
          // Populate users
          PR.settings.users();
          
          // Populate Admin Override Passcode (with fake value)
          if (plugin.settings.hash) { $('#PR input.pr-override').val('###{IGNORE}###'); }
        });
        
        // Add validation to plugin "Save" button
        PR.settings.app.find('.sui-bttn-primary').on('mousedown', function(e) {
          if (!PR.settings.validate()) {
            e.stopImmediatePropagation();
            return false;
          }
        });
      },
      
      // Validate settings
      validate: function() {
        plugin.settings.data = PR.settings.app.find('div.setting input').val();
        
        if (!PR.access(true)) {
          PR.err('The permissions you have defined would block your account from accessing Settings > Manage Apps. Please give yourself access to this module before saving.');
          return false;
        } else {
          
          // Save admin override passcode
          var passcode = $('#PR input.pr-override').val();
          if (passcode !== '###{IGNORE}###') {
            PR.settings.form.find('div.setting input[name^="hash"]').val(PR.override.hash(passcode));
          }
          
          return true;
        }
      },
      
      // Save settings
      save: function(reset) {
        
        // Load into memory
        $.each(PR.data, function(n, g) {
          if (g.name === PR.settings.group.current.name) {
            PR.data.splice(n, 1, PR.settings.group.current);
          }
        });
        
        var data = JSON.stringify(PR.data).replace('"[', '[').replace(']"', ']').replace(/\\/g, '');
        PR.settings.form.find('div.setting input[name^="data"]').val(data);

        PR.dbg('Settings Saved: ' + data);
        
        if (reset) { PR.settings.reset(); }
      },
      
      // Reset form fields
      reset: function() {
        $('.pr-group').val('');
        $('.pr-member').val('');
        $('.pr-members').empty();
        $('#PR :checkbox').prop('checked', false);
        
        $('.pr-group-add').removeClass('pr-hidden');
        $('.pr-group-save').addClass('pr-hidden');
        
        PR.settings.group.list();
        PR.settings.group.current = {};
      },
      
      // Populate users list
      users: function() {
        var users = $('.pr-member');
        var emails = [];
        
        $.each(PR.users, function() {
          users.append('<option value="' + this.id + '">' + this.first_name + ' ' + this.last_name + '</option>');
          emails.push(this.id + ":" + this.email);
        });
        
        PR.sort('.pr-member');
        
        users.prepend('<option value="">Select...</option>');
        
        // Save list of users/email address to "Users" hidden input
        PR.settings.form.find('div.setting input[name^="users"]').val(emails.toString());
      },
      
      // Populate permission options list
      permissions: function(list, opts) {
        list = $('<ul></ul>').appendTo(list);
        $.each(opts, function(n,v) {
          if (typeof v === 'string') {
            list.append('<li><input type="checkbox" value="' + v + '" /> <span>' + n + '</span></li>');
          } else {
            var sublist = $('<li><input type="checkbox" value="" /> <a href="javascript:">' + n + '</a></li>').appendTo(list);
            PR.settings.permissions(sublist, v);
          }
        });
      },
      
      // ------------------------------------------------------------------------
      
      /** GROUPS */
      
      group: {
        
        current: {},
        
        // List groups
        list: function() {
          var groups = $('.pr-groups').empty();
          
          $.each(PR.data, function() {
            groups.append('<option value="' + this.name + '">' + this.name + '</option>');
          });
          
          PR.sort('.pr-groups');
          
          groups.prepend('<option value="" selected="selected">New Group...</option>');
        },
        
        // Add group
        add: function() {
          var groups = $('.pr-groups');
          var group = $('.pr-group').val();
          
          // Validation
          if (!group) {
            PR.err('No group specified');
          } else if (groups.find('option[value="' + group + '"]').length > 0) {
            PR.err('Another group with this name already exists');
          } else {
            // Save group
            PR.data.push({ name: group, members: [], permissions: [] });
            PR.settings.save(true);
            groups.val(group).trigger('change');
          }
        },
        
        // Edit group
        edit: function(group) {
          $('.pr-group').val(group);
          
          // Load into memory
          $.each(PR.data, function() {
            if (this.name === group) {
              PR.dbg("PR.settings.group.current = " + JSON.stringify(this).replace(/\\/gi, ''));
              PR.settings.group.current = this;
              PR.settings.group.member.list();
              PR.settings.group.permission.list();
            }
          });
          
          // Swap buttons
          if (group) {
            $('.pr-group-add').addClass('pr-hidden');
            $('.pr-group-save').removeClass('pr-hidden');
          } else {
            PR.settings.reset();
          }
        },
        
        // Save group
        save: function() {
          var groups = $('.pr-groups');
          var group = $('.pr-group').val();
          
          // Validation
          if (groups.find('option[value="' + group + '"]:not(:selected)').length > 0) {
            PR.err('Another group with this name already exists');
          } else {
            // Save group
            PR.settings.group.current.name = group;
            PR.settings.save(true);
          }
        },
        
        // Delete group
        del: function() {
          var group = $('.pr-groups').val();
          
          // Validation
          if (!group) {
            PR.err('No group selected');
          } else {
            // Delete group
            PR.data = PR.data.filter(function(g) {
              return g.name !== group;
            });
            PR.settings.save(true);
          }
        },
        
        // ------------------------------------------------------------------------
        
        /** GROUP MEMBERS */
        
        member: {
          
          // List group members
          list: function() {
            var members = PR.settings.group.current.members;
            var list = $('.pr-members').empty();
            $.each(members, function() {
              list.append('<option value="' + this + '">' + $('.pr-member option[value="' + this + '"]').text() + '</option>');
            });
            PR.sort('.pr-members');
          },
          
          // Add member
          add: function(fld) {
            if (!PR.settings.group.current.members) { 
              PR.err('You must select a group first');
              return; 
            }
            
            var members = $('.pr-members');
            var member = $('.pr-member').val();
            var member_name = $('.pr-member option:selected').text();
            
            // Validation
            if (!member) {
              PR.err('No member selected');
            } else if (members.find('option[value="' + member + '"]').length < 1) {
              // Save member
              PR.settings.group.current.members.push(member);
              PR.settings.group.member.list();
              PR.settings.save();
            }
          },
          
          // Remove member
          del: function() {
            var members = $('.pr-members option:selected');
            
            // Validation
            if (!members.length) {
              PR.err('No member(s) selected');
            } else {
              // Delete member
              PR.settings.group.current.members = [];
              members.remove();
              $.each($('.pr-members option'), function() {
                PR.settings.group.current.members.push($(this).val());
              });
              PR.settings.save();
            }
          }
        },
        
        // ------------------------------------------------------------------------
        
        /** GROUP PERMISSIONS */
        
        permission: {
          
          // List permissions
          list: function() {
            PR.settings.app.find('.pr-access :checkbox').prop('checked', false);
            
            $.each(PR.settings.group.current.permissions, function() {
              // Match exact value, or options that contain the value (for backwards compatibility)
              var p = this.toString();
              var filter = ':checkbox[value="' + p + '"],:checkbox[value*="' + p + '||"],:checkbox[value*="||' + p + '"],:checkbox[value*="' + p + '.*"]';
              filter = (p === 'cloud_services' || p === 'purchases') ? ':checkbox[value="' + p + '"]' : filter;
              PR.dbg(filter);
              PR.settings.app.find(filter).prop('checked', true).parents('.pr-access ul').siblings(':checkbox').prop('checked', true);
            });
          },
          
          // Toggle parent checkboxes on/off
          parents: function(fld) {
            var parent = fld.closest('ul').siblings(':checkbox');
            if (parent.length) {
              if (!fld.is(':checked') && fld.parent().siblings().find(':checkbox:checked').length === 0) {
                parent.prop('checked', false);
              } else {
                parent.prop('checked', true);
              }
              
              // Check for more parents further up the DOM tree
              PR.settings.group.permission.parents(parent);
            }
          },
          
          // Save permissions
          save: function(fld) {             

            // Validation
            if (!$('.pr-groups').val()) {
              fld.prop('checked', false);
              PR.err('You must select a group first');
              return;
            }
            
            // "Select All"
            if (fld.is('#pr-checkall')) {
              PR.settings.app.find('.pr-access :checkbox').prop('checked', fld.prop('checked'));
            }
            
            // Required permissions
            if (fld.hasClass('pr-require') && !fld.is(':checked') && fld.parent().siblings().find(':checkbox:checked').length > 0) {
              fld.prop('checked', true);
              PR.err('Another permission you selected has a dependency on this permission. It cannot be unchecked.');
              return;
            }
            if (fld.is(':checked')) { fld.parent().siblings().find('.pr-require').prop('checked', true); }
            
            // Toggle parent permission on/off
            PR.settings.group.permission.parents(fld);

            // Toggle child permissions on/off
            fld.siblings('ul').find(':checkbox').prop('checked', fld.prop('checked'));
            
            // Save permissions
            PR.settings.group.current.permissions = [];
            $.each(PR.settings.app.find('.pr-access :checkbox[value!=""]:checked'), function() {
              PR.settings.group.current.permissions.push($(this).val());
            });
            PR.settings.group.current.version = PR.version;
            PR.settings.save();
          }
        }
      }
    }
  };
  
}(jQuery);

SPICEWORKS.app.ready(function() { PR.init(); });
SPICEWORKS.portalv2.ready(function() { PR.init(); });​