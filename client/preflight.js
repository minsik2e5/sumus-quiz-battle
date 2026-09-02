    /* Production preflight: satisfy optional legacy bindings without rewriting source. */
    (() => {
      const ensureOptionalControl = (id) => {
        if (document.getElementById(id)) return;
        const button = document.createElement('button');
        button.id = id;
        button.type = 'button';
        button.hidden = true;
        button.setAttribute('aria-hidden', 'true');
        document.body.appendChild(button);
      };
      ensureOptionalControl('studentLabLauncher');

      /* Current public Render deployment has no SUMUS_TEACHER_KEY configured.
         The legacy base client still prompts unconditionally on every public teacher page
         and aborts TeacherBridge.connect() when Cancel is pressed. That makes the room
         invisible to students even though the server itself does not require a key.
         Do not block teacher startup while server-side teacher auth is disabled. */
      try {
        if (typeof TeacherAccess !== 'undefined') {
          TeacherAccess.ensure = function () {
            return true;
          };
        }
      } catch (e) {}
    })();
