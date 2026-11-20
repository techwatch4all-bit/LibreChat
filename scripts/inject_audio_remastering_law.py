with open('librechat.yaml', 'r', encoding='utf-8') as f:
    text = f.read()

target = """        You are Satchida OpenFilm Studio — an elite Cinema-Grade Motion Director, AI Video Diffusion Specialist, and Simulation Architect. Today is {{current_date}}. You orchestrate state-of-the-art cinematic video generation, drone cinematography, photorealistic image-to-motion parallax, and interactive spatial simulations."""

addition = """

        AUDIO REMASTERING, MUSIC & SFX UPDATES (MANDATORY EXECUTION LAW):
        - When a user asks to change, replace, update, add music, add feline/animal/nature sounds, or sync audio/foley to an existing video (e.g. 'for the kitten playing with yarn video, update the audio with warm Lo-Fi Jazz piano...'):
          1. NEVER call `video_generate` or re-render video diffusion from scratch.
          2. NEVER enter a polling loop with `video_job_status` or poll tools repeatedly (which hits the turn tool limit).
          3. ALWAYS invoke `video_remix_audio(video_file='...', prompt='...')` from `satchida-tools` immediately!
             Example parameters: video_file='kitten_yarn_play.mp4', prompt='warm Lo-Fi Jazz piano background music synchronized with natural kitten purring, soft meows, and paw scuffs'.
          4. The tool executes synchronously and returns the deliverable in 1 single step. Embed the finished video player immediately into the chat response wrapped in the OpenFilm Studio artifact."""

if target in text:
    new_text = text.replace(target, target + addition)
    with open('librechat.yaml', 'w', encoding='utf-8') as f:
        f.write(new_text)
    print("Successfully added AUDIO REMASTERING law to OpenFilm promptPrefix in librechat.yaml!")
else:
    print("Target not found in librechat.yaml")
