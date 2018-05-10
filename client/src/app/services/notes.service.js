"use strict";

angular
  .module('sugg.services')
  .factory('Note', ['Refs', 'User', '$q', '$rootScope', '$firebaseArray', '$firebaseObject',
    function(Refs, User, $q, $rootScope, $firebaseArray, $firebaseObject) {
      var time = Firebase.ServerValue.TIMESTAMP;

      return {
        create: function(uid, title, body, settings, tags) {
          var deferred = $q.defer();
          var notes = $firebaseArray(Refs.notes);

          notes.$add({
            'content': body,
            'lang': 'html',
            'settings': Object.assign(settings, {
              'is_public': false
            })
          }).then(function(ref) {
            var noteId = ref.key();

            if (noteId) {
              var metadata = $firebaseArray(Refs.users.child(uid).child('metadata'));

              metadata.$add({
                'note_id': noteId,
                'title': title,
                'created': time,
                'updated': time,
                'is_public': false,
                'tags': tags.map(function(tag) { return tag.tag_id; })
              }).then(function(ref) {
                deferred.resolve({ metadataId: ref.key(), noteId: noteId });
              })
              .catch(function(error) {
                deferred.reject(error);
              });
            } else {
              deferred.reject('error occurred');
            }
          })
          .catch(function(error) {
            deferred.reject(error);
          });

          return deferred.promise;
        },

        notes: function() {
          var deferred = $q.defer();
          var data = $firebaseArray(Refs.notes);

          data.$loaded()
            .then(function(data) {
              deferred.resolve(data);
            })
            .catch(function(error) {
              deferred.reject(error);
            });

          return deferred.promise;
        },

        metadata: function(uid) {
          var deferred = $q.defer();
          var data = $firebaseArray(Refs.users.child(uid).child('metadata'));

          data.$loaded()
            .then(function(data) {
              deferred.resolve(data);
            })
            .catch(function(error) {
              deferred.reject(error);
            });

          return deferred.promise;
        },

        all: function(uid) {
          var deferred = $q.defer();
          var qry1 = $firebaseArray(Refs.users.child(uid).child('metadata'));
          var self = this;

          self.result = null;
          self.note;

          qry1.$loaded()
            .then(function(data) { return data; })
            .then(function(metadata) {
              var qry2 = $firebaseArray(Refs.notes);

              return qry2.$loaded()
                .then(function(notes) {
                  return { 'metadata': metadata, 'notes': notes };
                });
            }) // TODO: loop through metadata tags and add tag title
            .then(function(data) {
              self.result = [];

              if (data.notes.length > 0 && data.metadata.length > 0) {
                _.each(data.metadata, function(metadata, key) {
                  self.note = _.find(data.notes, { $id: metadata.note_id });
                  self.note['metadata'] = metadata;
                  self.note['Selected'] = false;
                  self.result.push(self.note);

                  if ((key + 1) === data.metadata.length) {
                    deferred.resolve(self.result);
                  }
                });
              } else {
                deferred.resolve([]);
              }
            })
            .catch(function(error) {
              deferred.reject(error);
            });

          return deferred.promise;
        },

        findNote: function(noteId) {
          var deferred = $q.defer();
          var data = $firebaseObject(Refs.notes.child(noteId));

          data.$loaded()
            .then(function(note) {
              deferred.resolve(note);
            })
            .catch(function(error) {
              deferred.reject(error);
            });

          return deferred.promise;
        },

        findMetadata: function(uid, metadataId) {
          var deferred = $q.defer();
          var data = $firebaseObject(Refs.users.child(uid).child('metadata').child(metadataId));

          data.$loaded()
            .then(function(metadata) {
              deferred.resolve(metadata);
            })
            .catch(function(error) {
              deferred.reject(error);
            });

          return deferred.promise;
        },

        findMetadataShare: function(uid, metadataId, shareUID) {
          var deferred = $q.defer();
          var data = $firebaseObject(Refs.users.child(uid).child('metadata').child(metadataId).child('share_with').child(shareUID));

          data.$loaded()
            .then(function(metadataShare) {
              deferred.resolve(metadataShare);
            })
            .catch(function(error) {
              deferred.reject(error);
            });

          return deferred.promise;
        },

        findNoteShare: function(noteId, shareUID) {
          var deferred = $q.defer();
          var data = $firebaseObject(Refs.notes.child(noteId).child('settings').child('share_with').child(shareUID));

          data.$loaded()
            .then(function(noteShare) {
              deferred.resolve(noteShare);
            })
            .catch(function(error) {
              deferred.reject(error);
            });

          return deferred.promise;
        },

        remove: function(uid, noteId, metadataId) {
          var deferred = $q.defer();
          var self = this;

          self.findNote(noteId).then(function(note) {
            self.findMetadata(uid, metadataId).then(function(metadata) {

              $q.all([metadata.$remove(), note.$remove()])
                .then(function(refs) {
                  deferred.resolve(refs);
                })
                .catch(function(error) {
                  deferred.reject(error);
                });
            })
            .catch(function(error) {
              deferred.reject(error);
            });
          })
          .catch(function(error) {
            deferred.reject(error);
          });

          return deferred.promise;
        },

        edit: function(uid, noteId, metadataId, options) {
          var deferred = $q.defer();
          var self = this;

          self.findNote(noteId).then(function(note) {
            self.findMetadata(uid, metadataId).then(function(metadata) {
              if (options.content) {
                note.content = options.content;
              }

              if (options.color) {
                note.settings.color = options.color;
              }

              if (options.type == 'share') {
                note.settings.is_public = options.isPublic;
                metadata.is_public = options.isPublic;
              }

              metadata.updated = time;

              $q.all([note.$save(), metadata.$save()])
                .then(function(refs) {
                  deferred.resolve(refs);
                })
                .catch(function(error) {
                  deferred.reject(error);
                });
            })
            .catch(function(error) {
              deferred.reject(error);
            });
          })
          .catch(function(error) {
            deferred.reject(error);
          });

          return deferred.promise;
        },

        share: function(uid, noteId, metadataId, shareUID) {
          var deferred = $q.defer();
          var noteShare = $firebaseArray(Refs.notes.child(noteId).child('settings').child('share_with').child(shareUID));
          var metadataShare = $firebaseArray(Refs.users.child(uid).child('metadata').child(metadataId).child('share_with').child(shareUID));
          var sharedWith = $firebaseArray(Refs.users.child(shareUID).child('shared_with_me'));

          sharedWith.$add({
            shared_at: time,
            read: true,
            write: true,
            note_id: noteId,
            metadata_id: metadataId,
            shared_by: uid
          }).then(function(ref) {

              $q.all([
                noteShare.$ref().set({
                  shared_at: time,
                  share_id: ref.key(),
                  read: true,
                  write: true
                }),
                metadataShare.$ref().set({
                  shared_at: time,
                  share_id: ref.key(),
                  read: true,
                  write: true
                })
              ])
              .then(function(data) {
                deferred.resolve();
              })
              .catch(function(error) {
                deferred.reject(error);
              });

            })
            .catch(function(error) {
              deferred.reject(error);
            });

          return deferred.promise;
        },

        allShare: function(uid, metadataId) {
          var deferred = $q.defer();
          var data = $firebaseArray(Refs.users.child(uid).child('metadata').child(metadataId).child('share_with'));
          var self = this;

          self.shareUsers = null;

          data.$loaded()
            .then(function(metadata) {
              if (metadata.length) {
                self.shareUsers = [];

                _.each(metadata, function(meta, key) {
                  User.find(meta.$id)
                    .then(function(user) {
                      self.shareUsers.push(user);
                    })
                    .catch(function(error) {
                      deferred.reject(error);
                    })

                    if ((key + 1) === metadata.length) {
                      deferred.resolve(self.shareUsers);
                    }
                });
              } else {
                deferred.resolve([]);
              }
            })
            .catch(function(error) {
              deferred.reject(error);
            });

          return deferred.promise;
        },

        removeShare: function(uid, noteId, metadataId, shareUID, sharedWithMeId) {
          var sharedWithMeData = $firebaseObject(Refs.users.child(shareUID).child('shared_with_me').child(sharedWithMeId));
          var deferred = $q.defer();
          var self = this;

          self.findMetadataShare(uid, metadataId, shareUID).then(function(metadataShare) {
            self.findNoteShare(noteId, shareUID).then(function(noteShare) {

              $q.all([metadataShare.$remove(), noteShare.$remove(), sharedWithMeData.$remove()])
                .then(function(refs) {
                  deferred.resolve();
                })
                .catch(function(error) {
                  deferred.reject(error);
                });
            })
            .catch(function(error) {
              deferred.reject(error);
            });
          })
          .catch(function(error) {
            deferred.reject(error);
          });

          return deferred.promise;
        },

        rename: function(uid, metadataId, title) {
          var deferred = $q.defer();
          var self = this;

          self.findMetadata(uid, metadataId).then(function(metadata) {
            metadata.title = title;
            metadata.updated = time;

            metadata.$save()
              .then(function(metaRef) {
                deferred.resolve(metaRef);
              })
              .catch(function(error) {
                deferred.reject(error);
              });
          })
          .catch(function(error) {
            deferred.reject(error);
          });

          return deferred.promise;
        },

        sync: function(uid) {
          var Notes = $firebaseArray(Refs.notes);
          var metadata = $firebaseArray(Refs.users.child(uid).child('metadata'));
          var self = this;

          Notes.$watch(function(e) {
            if (e.event === 'child_removed') {
              self.all(uid)
                .then(function(notes) {
                  self.prepForBroadcast('syncedNotes', notes);
                })
                .catch(function() {
                  self.prepForBroadcast('syncedNotes', []);
                });
            }
          });

          metadata.$watch(function(e) {
            if (e.event === 'child_changed') {
              self.all(uid)
                .then(function(notes) {
                  self.prepForBroadcast('syncedNotes', notes);
                })
                .catch(function() {
                  self.prepForBroadcast('syncedNotes', []);
                });
            }
          });
        },

        prepForBroadcast: function(key, msg) {
          var self = this;

          self[key] = msg;
          self.broadcastItem(self);
        },

        broadcastItem: function(data) {
          $rootScope.$broadcast('handleBroadcast', data);
        }
      };
  }]);
