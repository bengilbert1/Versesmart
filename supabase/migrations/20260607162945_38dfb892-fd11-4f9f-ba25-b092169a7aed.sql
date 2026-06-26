
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_new_user_signup()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_secret text;
  v_base_url text;
  v_provider text;
  v_body jsonb;
begin
  begin
    select decrypted_secret into v_secret
      from vault.decrypted_secrets
      where name = 'email_queue_service_role_key'
      limit 1;

    -- Hard-coded production base URL for the admin notify endpoint.
    -- Using the published custom domain so the request reaches the live build.
    v_base_url := 'https://versesmart.org';

    if v_secret is null then
      raise warning 'notify_new_user_signup: missing service role secret in vault';
      return new;
    end if;

    v_provider := coalesce(
      new.raw_app_meta_data->>'provider',
      (new.raw_app_meta_data->'providers'->>0),
      'email'
    );

    v_body := jsonb_build_object(
      'user_id', new.id::text,
      'email', new.email,
      'provider', v_provider,
      'created_at', to_char((new.created_at at time zone 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    );

    perform net.http_post(
      url := v_base_url || '/api/public/admin/new-user-notify',
      body := v_body,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_secret
      ),
      timeout_milliseconds := 5000
    );
  exception when others then
    raise warning 'notify_new_user_signup failed: %', sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_notify on auth.users;
create trigger on_auth_user_created_notify
  after insert on auth.users
  for each row execute function public.notify_new_user_signup();
