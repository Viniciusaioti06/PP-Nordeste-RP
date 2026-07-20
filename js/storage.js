
const PPStore = (() => {
  const APP_KEY = "pp_v2_applications";
  const SESSION_KEY = "pp_v2_admin_session";
  const CANDIDATE_KEY = "pp_v2_candidate_session";
  const SETTINGS_KEY = "pp_v2_settings";
  const QUESTIONS_KEY = "pp_v2_questions";
  const USERS_KEY = "pp_v4_staff_users";
  const AUDIT_KEY = "pp_v4_audit_logs";
  const CURRENT_USER_KEY = "pp_v4_current_staff";
  const ANNOUNCEMENTS_KEY = "pp_v5_announcements";

  const readJSON = (key, fallback=[]) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const writeJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));


  const defaultPermissions = {
    recruiter:{dashboard_view:true,candidates_view:true,candidates_review:true,candidates_approve:true,candidates_reject:true,interviews_manage:true,questions_view:true,questions_manage:false,settings_manage:false,staff_manage:false,audit_view:false,applications_delete:false,announcements_manage:false},
    supervisor:{dashboard_view:true,candidates_view:true,candidates_review:true,candidates_approve:true,candidates_reject:true,interviews_manage:true,questions_view:true,questions_manage:true,settings_manage:false,staff_manage:false,audit_view:true,applications_delete:false,announcements_manage:true},
    admin:{dashboard_view:true,candidates_view:true,candidates_review:true,candidates_approve:true,candidates_reject:true,interviews_manage:true,questions_view:true,questions_manage:true,settings_manage:true,staff_manage:true,audit_view:true,applications_delete:true,announcements_manage:true}
  };

  const seedUsers = () => {
    const current=readJSON(USERS_KEY,null);
    if(Array.isArray(current)) return current;
    writeJSON(USERS_KEY,[]);
    return [];
  };

  const needsInitialSetup = () => users().length===0;

  const createInitialAdmin = data => {
    if(!needsInitialSetup()) return {ok:false,reason:"already_configured"};
    const now=new Date().toISOString();
    const user={id:`staff-${Date.now()}-${Math.random().toString(16).slice(2)}`,name:data.name.trim(),username:data.username.trim(),email:data.email.trim(),discord:data.discord.trim(),password:data.password,role:"admin",active:true,permissions:{...defaultPermissions.admin},lastLogin:null,createdAt:now,updatedAt:now};
    saveUsers([user]);
    addAudit("initial_admin_created","staff",user.id,null,{...user,password:"***"},user);
    return {ok:true,user};
  };

  const users = () => readJSON(USERS_KEY, []);
  const saveUsers = value => writeJSON(USERS_KEY, value);

  const currentUser = () => {
    const id = sessionStorage.getItem(CURRENT_USER_KEY);
    return users().find(user => user.id === id) || null;
  };

  const loginStaff = (username, password) => {
    const list = users();
    const index = list.findIndex(user =>
      user.username.toLowerCase() === String(username).trim().toLowerCase() &&
      user.password === password
    );
    if (index < 0) return {ok:false, reason:"invalid"};
    if (!list[index].active) return {ok:false, reason:"inactive"};
    list[index].lastLogin = new Date().toISOString();
    list[index].updatedAt = new Date().toISOString();
    saveUsers(list);
    sessionStorage.setItem(CURRENT_USER_KEY, list[index].id);
    sessionStorage.setItem(SESSION_KEY, "1");
    addAudit("login", "staff", list[index].id, null, {username:list[index].username}, list[index]);
    return {ok:true, user:list[index]};
  };

  const logoutStaff = () => {
    sessionStorage.removeItem(CURRENT_USER_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  };

  const hasPermission = permission => {
    const user = currentUser();
    return !!(user && user.active && user.permissions?.[permission]);
  };

  const requirePermission = permission => {
    if (!currentUser()) return {allowed:false, reason:"unauthenticated"};
    if (!hasPermission(permission)) return {allowed:false, reason:"forbidden"};
    return {allowed:true};
  };

  const addAudit = (action, resourceType, resourceId, oldData=null, newData=null, actorOverride=null) => {
    const actor = actorOverride || currentUser();
    const logs = readJSON(AUDIT_KEY, []);
    logs.unshift({
      id: `audit-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      actorId: actor?.id || null,
      actorName: actor?.name || "Sistema",
      actorRole: actor?.role || "system",
      action,
      resourceType,
      resourceId,
      oldData,
      newData,
      createdAt: new Date().toISOString()
    });
    writeJSON(AUDIT_KEY, logs.slice(0, 500));
  };

  const auditLogs = () => readJSON(AUDIT_KEY, []);

  const createStaffUser = data => {
    const list = users();
    const now = new Date().toISOString();
    const role = ["admin","supervisor","recruiter"].includes(data.role) ? data.role : "recruiter";
    const user = {
      id: `staff-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: data.name.trim(),
      username: data.username.trim(),
      email: data.email.trim(),
      discord: data.discord.trim(),
      password: data.password,
      role,
      active: data.active !== false,
      permissions: {...defaultPermissions[role], ...(data.permissions || {})},
      lastLogin: null,
      createdAt: now,
      updatedAt: now
    };
    list.push(user);
    saveUsers(list);
    addAudit("staff_created", "staff", user.id, null, {...user, password:"***"});
    return user;
  };

  const updateStaffUser = (id, patch) => {
    const list = users();
    const index = list.findIndex(user => user.id === id);
    if (index < 0) return null;
    const oldData = {...list[index], password:"***"};
    const nextRole = patch.role || list[index].role;
    list[index] = {
      ...list[index],
      ...patch,
      permissions: patch.permissions || list[index].permissions || {...defaultPermissions[nextRole]},
      updatedAt: new Date().toISOString()
    };
    saveUsers(list);
    addAudit("staff_updated", "staff", id, oldData, {...list[index], password:"***"});
    return list[index];
  };

  const deleteStaffUser = id => {
    const actor = currentUser();
    if (actor?.id === id) return {ok:false, reason:"self"};
    const list = users();
    const target = list.find(user => user.id === id);
    if (!target) return {ok:false, reason:"missing"};
    saveUsers(list.filter(user => user.id !== id));
    addAudit("staff_deleted", "staff", id, {...target, password:"***"}, null);
    return {ok:true};
  };


  const seedAnnouncements = () => {
    const current = readJSON(ANNOUNCEMENTS_KEY, null);
    if (Array.isArray(current)) return current;
    writeJSON(ANNOUNCEMENTS_KEY, []);
    return [];
  };

  const announcements = () => readJSON(ANNOUNCEMENTS_KEY, []);
  const saveAnnouncements = value => writeJSON(ANNOUNCEMENTS_KEY, value);

  const createAnnouncement = data => {
    const list = announcements();
    const now = new Date().toISOString();
    const item = {
      id: `announcement-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: data.title.trim(),
      message: data.message.trim(),
      audienceStatus: data.audienceStatus || "Aprovado no teste teórico",
      active: data.active !== false,
      createdBy: currentUser()?.name || "Administrador",
      createdAt: now,
      updatedAt: now
    };
    list.unshift(item);
    saveAnnouncements(list);
    addAudit("announcement_created", "announcement", item.id, null, item);
    return item;
  };

  const updateAnnouncement = (id, patch) => {
    const list = announcements();
    const index = list.findIndex(item => item.id === id);
    if (index < 0) return null;
    const oldData = {...list[index]};
    list[index] = {...list[index], ...patch, updatedAt: new Date().toISOString()};
    saveAnnouncements(list);
    addAudit("announcement_updated", "announcement", id, oldData, list[index]);
    return list[index];
  };

  const deleteAnnouncement = id => {
    const list = announcements();
    const target = list.find(item => item.id === id);
    if (!target) return false;
    saveAnnouncements(list.filter(item => item.id !== id));
    addAudit("announcement_deleted", "announcement", id, target, null);
    return true;
  };

  const announcementsForStatus = status =>
    announcements().filter(item => item.active && item.audienceStatus === status);

  const seedQuestions = () => {
    const current = readJSON(QUESTIONS_KEY, null);
    if (Array.isArray(current) && current.length) {
      // Migra questões antigas para o novo formato sem apagar os dados existentes.
      const migrated = current.map((q, index) => ({
        id: q.id || `q-${Date.now()}-${index}`,
        title: q.title || "Pergunta sem título",
        description: q.description || "",
        category: q.category || "Geral",
        type: q.type || "open",
        required: q.required !== false,
        active: q.active !== false,
        order: Number.isFinite(q.order) ? q.order : index + 1,
        points: Number(q.points || 0),
        options: Array.isArray(q.options) ? q.options : [],
        correctOption: q.correctOption ?? "",
        eliminatoryOptions: Array.isArray(q.eliminatoryOptions) ? q.eliminatoryOptions : [],
        minLength: Number(q.minLength || 0),
        manualCriteria: q.manualCriteria || ""
      }));
      writeJSON(QUESTIONS_KEY, migrated);
      return migrated;
    }

    const seed = [
      {
        id:"provocation", title:"Um detento começa a provocar verbalmente um agente. Como você reage?",
        description:"Avalia postura, maturidade e respeito aos procedimentos.",
        category:"Conduta", type:"objective", required:true, active:true, order:1, points:3,
        options:[
          {id:"p1",label:"Mantenho a postura e sigo o procedimento adequado.",points:3},
          {id:"p2",label:"Respondo no mesmo tom para impor respeito.",points:1},
          {id:"p3",label:"Uso força imediatamente.",points:0}
        ],
        correctOption:"p1", eliminatoryOptions:[], minLength:0, manualCriteria:""
      },
      {
        id:"hierarchy", title:"Você recebe uma ordem que considera equivocada, mas que não viola nenhuma regra.",
        description:"Avalia respeito à hierarquia e uso dos canais internos.",
        category:"Hierarquia", type:"objective", required:true, active:true, order:2, points:3,
        options:[
          {id:"h1",label:"Cumpro e depois converso pelo canal correto.",points:3},
          {id:"h2",label:"Discuto publicamente com o superior.",points:1},
          {id:"h3",label:"Ignoro e faço do meu jeito.",points:0}
        ],
        correctOption:"h1", eliminatoryOptions:[], minLength:0, manualCriteria:""
      },
      {
        id:"corruption", title:"Você aceitaria dinheiro ou favores para facilitar a fuga de um preso?",
        description:"Pergunta eliminatória relacionada à ética e corrupção.",
        category:"Ética", type:"eliminatory", required:true, active:true, order:3, points:0,
        options:[
          {id:"c1",label:"Não, em nenhuma hipótese.",points:0},
          {id:"c2",label:"Talvez, dependendo da situação.",points:0},
          {id:"c3",label:"Sim, caso a recompensa fosse boa.",points:0}
        ],
        correctOption:"c1", eliminatoryOptions:["c2","c3"], minLength:0, manualCriteria:""
      },
      {
        id:"escape", title:"Durante uma transferência, um preso tenta fugir e outro agente começa a atirar sem autorização. Como você reage?",
        description:"Descreva a conduta adotada e os procedimentos que seguiria.",
        category:"Roleplay", type:"open", required:true, active:true, order:4, points:10,
        options:[], correctOption:"", eliminatoryOptions:[], minLength:50,
        manualCriteria:"Avaliar controle emocional, comunicação, preservação da vida, hierarquia e proporcionalidade."
      },
      {
        id:"force", title:"Como equilibrar autoridade, respeito e uso proporcional da força?",
        description:"Explique os limites da atuação de um policial penal.",
        category:"Conduta", type:"open", required:true, active:true, order:5, points:10,
        options:[], correctOption:"", eliminatoryOptions:[], minLength:50,
        manualCriteria:"Avaliar proporcionalidade, escalonamento do uso da força e respeito ao roleplay."
      },
      {
        id:"motivation", title:"Por que deseja ingressar na Polícia Penal?",
        description:"Apresente sua motivação e o que pretende contribuir para a corporação.",
        category:"Perfil", type:"open", required:true, active:true, order:6, points:10,
        options:[], correctOption:"", eliminatoryOptions:[], minLength:50,
        manualCriteria:"Avaliar autenticidade, maturidade, disponibilidade e alinhamento com a corporação."
      }
    ];
    writeJSON(QUESTIONS_KEY, seed);
    return seed;
  };

  const seedSettings = () => {
    const current = readJSON(SETTINGS_KEY, null);
    if (current) return current;
    const seed = {recruitmentOpen:true,minimumScore:4,retryDays:7,showPublicReason:false};
    writeJSON(SETTINGS_KEY, seed);
    return seed;
  };

  const applications = () => readJSON(APP_KEY, []);
  const saveApplications = items => writeJSON(APP_KEY, items);

  const generateProtocol = () => {
    const year = new Date().getFullYear();
    return `PP-${year}-${String(applications().length + 1).padStart(4,"0")}`;
  };

  const createApplication = data => {
    const items = applications();
    items.unshift(data);
    saveApplications(items);
    return data;
  };

  const updateApplication = (id, patch) => {
    const items = applications();
    const index = items.findIndex(i=>i.id===id);
    if(index<0) return null;
    items[index] = {...items[index],...patch,updatedAt:new Date().toISOString()};
    saveApplications(items);
    return items[index];
  };

  const findByProtocol = protocol => applications().find(a=>a.protocol.toLowerCase()===String(protocol).trim().toLowerCase());

  const setAdminSession = active => {
    if (!active) logoutStaff();
    else sessionStorage.setItem(SESSION_KEY,"1");
  };
  const hasAdminSession = () => sessionStorage.getItem(SESSION_KEY)==="1" && !!currentUser();

  const setCandidateSession = appId => appId ? sessionStorage.setItem(CANDIDATE_KEY,appId) : sessionStorage.removeItem(CANDIDATE_KEY);
  const candidateSession = () => sessionStorage.getItem(CANDIDATE_KEY);

  seedUsers(); seedAnnouncements(); seedQuestions(); seedSettings();
  return {
    applications,saveApplications,generateProtocol,createApplication,updateApplication,findByProtocol,
    setAdminSession,hasAdminSession,setCandidateSession,candidateSession,
    questions:()=>readJSON(QUESTIONS_KEY,[]),saveQuestions:q=>writeJSON(QUESTIONS_KEY,q),
    settings:()=>readJSON(SETTINGS_KEY,{}),saveSettings:s=>writeJSON(SETTINGS_KEY,s),
    users,saveUsers,currentUser,loginStaff,logoutStaff,hasPermission,requirePermission,
    defaultPermissions,needsInitialSetup,createInitialAdmin,createStaffUser,updateStaffUser,deleteStaffUser,addAudit,auditLogs,
    announcements,saveAnnouncements,createAnnouncement,updateAnnouncement,deleteAnnouncement,announcementsForStatus
  };
})();
