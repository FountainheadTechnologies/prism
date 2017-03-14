DROP DATABASE IF EXISTS "prism-integration-test";
CREATE DATABASE "prism-integration-test";
\c "prism-integration-test";

CREATE TABLE tasks (
	id serial,
	title character varying(255) NOT NULL,
	description character varying(255),
	complete boolean NOT NULL DEFAULT false,
	project integer NOT NULL,
	owner integer NOT NULL,
	PRIMARY KEY (id)
);

CREATE TABLE projects (
	id serial,
	name character varying(255) NOT NULL,
	PRIMARY KEY (id)
);

CREATE TABLE users (
	id serial,
	username character varying(255) NOT NULL,
	password character varying(255) NOT NULL,
	enabled boolean NOT NULL default true,
	department integer NOT NULL,
	PRIMARY KEY (id)
);

CREATE TABLE departments (
	id serial,
	name character varying(255) NOT NULL,
	PRIMARY KEY (id)
);

ALTER TABLE tasks ADD FOREIGN KEY (project) REFERENCES projects;
ALTER TABLE tasks ADD FOREIGN KEY (owner) REFERENCES users;
ALTER TABLE users ADD FOREIGN KEY (department) REFERENCES departments;

INSERT INTO departments (name) VALUES
	('Engineering'),
	('Marketing'),
	('Finance');

-- Password is '{{username}}-password'
INSERT INTO users (username, password, enabled, department) VALUES
	('Freddy_Feil48', '$2a$04$0cSHRk6Eh8ppEj3Lhb9utu3xMGmn.E4pckSbs2KJRq2.ovhLl2gci', true, 1),
	('Kaley6', '$2a$06$XFnj1o/CzYCxVT6O8TaqtuU0Wr91PXiBjqTaH/R7Yx5zH6rheMj3i', true, 1),
	('Cali_Lockman', '$2a$04$NGJ71G1JW4lSXq4LY2bYPO9zzLA5rTx2FzdvRLqSjvcyg83LWnsze', true, 2),
	('Lois.Thompson', '$2a$04$rS1cG3r7ptfStvbdhrZhauNJSmArd2IZ5OmuiMA1oRRfTKoV7Eele', false, 2),
	('Jeffrey_Hayes', '$2a$04$8y/.27VfapjYgu1y/Uit..nSIMknXMf5ni.p.EtsEOfQ8011FIzka', false, 3),
	('Bell78', '$2a$04$HwtAUlZOHa7RZgxNIsXp/u8zl8fN58j.sgk/wMsfEglUb3Bxrl5l6', true, 3);

INSERT INTO projects (name) VALUES
	('Vertical Interface'),
	('Virtual Architecture'),
	('Killer Analyzer');

INSERT INTO tasks (title, description, project, owner, complete) VALUES
	('index virtual pixel', 'You can''t generate the driver without hacking the virtual AGP card!', 1, 1, false),
	('calculate bluetooth array', 'I''ll parse the digital USB bandwidth, that should pixel the FTP transmitter!', 2, 2, true),
	('back up virtual microchip', null, 1, 1, true),
	('program virtual transmitter', null, 2, 1, true),
	('program digital sensor', 'The XML microchip is down, copy the back-end hard drive so we can bypass the XML bandwidth!', 1, 2, false),
	('calculate 1080p driver', null, 1, 2, false),
	('synthesize primary circuit', null, 1, 2, true),
	('reboot online array', null, 1, 2, true),
	('input optical microchip', 'Use the multi-byte SMS program, then you can input the haptic capacitor!', 1, 1, true),
	('bypass primary pixel', null, 1, 1, false),
	('generate back-end port', null, 2, 2, true),
	('index wireless circuit', null, 1, 1, true),
	('hack 1080p pixel', 'If we quantify the microchip, we can get to the PNG firewall through the bluetooth AI driver!', 1, 2, true),
	('index multi-byte bandwidth', null, 2, 2, true),
	('bypass digital hard drive', null, 2, 2, true),
	('quantify haptic firewall', null, 2, 1, true),
	('input solid state transmitter', null, 1, 1, true),
	('reboot primary bandwidth', 'We need to generate the auxiliary SDD alarm!', 1, 1, false),
	('transmit neural capacitor', null, 1, 2, true),
	('back up open-source transmitter', null, 2, 1, true),
	('generate wireless interface', null, 2, 1, false),
	('calculate open-source bus', null, 2, 1, true),
	('index back-end array', 'Try to hack the SAS interface, maybe it will override the optical card!', 1, 2, false),
	('reboot primary program', null, 2, 1, false),
	('transmit online port', null, 2, 1, false),
	('reboot solid state firewall', 'If we navigate the interface, we can get to the PNG panel through the solid state ADP hard drive!', 1, 2, true),
	('parse back-end matrix', null, 2, 2, false),
	('back up online matrix', 'The AI system is down, quantify the 1080p array so we can override the SQL bandwidth!', 1, 2, false),
	('reboot primary hard drive', 'You can''t calculate the sensor without navigating the open-source AI hard drive!', 1, 2, true),
	('calculate haptic application', 'Use the cross-platform SAS firewall, then you can copy the virtual application!', 1, 1, true),
	('index digital transmitter', 'generating the alarm won''t do anything, we need to index the primary XSS panel!', 2, 2, false),
	('synthesize primary interface', 'Try to program the XML panel, maybe it will copy the 1080p firewall!', 1, 2, false),
	('quantify optical bus', 'Use the bluetooth XSS interface, then you can generate the 1080p feed!', 1, 2, true),
	('connect optical bus', null, 2, 2, true),
	('back up mobile bus', 'Use the wireless IB microchip, then you can calculate the haptic port!', 2, 1, false),
	('index online port', 'Use the haptic ADP pixel, then you can hack the virtual application!', 2, 1, false),
	('compress haptic circuit', null, 1, 2, false),
	('override wireless card', null, 2, 1, false),
	('back up virtual microchip', null, 2, 2, true),
	('transmit cross-platform firewall', 'You can''t parse the microchip without generating the redundant PNG card!', 1, 1, true),
	('override open-source program', null, 2, 2, false),
	('index cross-platform monitor', null, 2, 1, true),
	('bypass bluetooth circuit', 'We need to hack the haptic COM interface!', 1, 2, true),
	('program 1080p monitor', null, 1, 2, true),
	('override bluetooth circuit', 'synthesizing the hard drive won''t do anything, we need to copy the primary SSL driver!', 1, 1, false),
	('navigate 1080p transmitter', 'Try to connect the PNG circuit, maybe it will override the redundant card!', 2, 2, true),
	('calculate multi-byte sensor', 'You can''t generate the alarm without indexing the solid state XML monitor!', 2, 1, true),
	('copy auxiliary sensor', 'I''ll reboot the haptic JSON firewall, that should transmitter the GB circuit!', 2, 1, false),
	('generate neural circuit', 'If we reboot the bus, we can get to the RSS alarm through the optical JSON pixel!', 1, 2, false),
	('navigate digital program', null, 1, 1, true),
	('override back-end circuit', null, 2, 1, true),
	('calculate multi-byte feed', 'You can''t transmit the panel without parsing the bluetooth SAS pixel!', 1, 2, false),
	('transmit back-end feed', null, 1, 2, false),
	('parse digital bus', 'The THX application is down, hack the multi-byte interface so we can transmit the TCP monitor!', 2, 1, false),
	('hack redundant microchip', null, 1, 2, false),
	('transmit auxiliary bandwidth', null, 1, 1, false),
	('hack redundant capacitor', 'I''ll calculate the 1080p AI firewall, that should matrix the SSL sensor!', 2, 2, true),
	('quantify wireless monitor', null, 2, 1, true),
	('synthesize virtual system', 'quantifying the program won''t do anything, we need to override the redundant GB firewall!', 2, 2, false),
	('connect back-end matrix', 'We need to navigate the virtual JSON sensor!', 2, 1, false),
	('connect open-source feed', 'Try to copy the SQL array, maybe it will parse the cross-platform firewall!', 2, 1, true),
	('calculate virtual bus', 'The SAS card is down, connect the 1080p array so we can copy the XSS microchip!', 2, 2, true),
	('index haptic alarm', null, 1, 2, true),
	('generate bluetooth capacitor', 'We need to copy the digital SMTP monitor!', 2, 1, true),
	('quantify virtual interface', null, 2, 2, false),
	('generate open-source hard drive', null, 2, 1, false),
	('copy 1080p protocol', 'Use the multi-byte SMS bandwidth, then you can index the optical bus!', 1, 2, true),
	('bypass optical array', 'The ADP protocol is down, input the 1080p application so we can back up the AI driver!', 2, 2, true),
	('bypass 1080p transmitter', 'hacking the panel won''t do anything, we need to bypass the haptic RAM hard drive!', 2, 1, true),
	('copy back-end bandwidth', null, 1, 2, true),
	('transmit wireless alarm', null, 1, 2, true),
	('calculate bluetooth driver', null, 2, 2, true),
	('bypass solid state matrix', 'If we parse the card, we can get to the PNG program through the 1080p USB transmitter!', 2, 2, true),
	('parse wireless hard drive', null, 2, 2, false),
	('bypass redundant sensor', 'You can''t compress the hard drive without connecting the multi-byte CSS protocol!', 2, 1, false),
	('parse redundant interface', null, 1, 2, true),
	('copy back-end panel', null, 1, 1, false),
	('compress open-source bandwidth', 'Try to input the SCSI driver, maybe it will synthesize the neural driver!', 1, 2, false),
	('program auxiliary firewall', null, 1, 1, false),
	('bypass multi-byte firewall', 'If we input the feed, we can get to the GB application through the multi-byte TCP alarm!', 2, 1, true),
	('override online feed', 'The IB bandwidth is down, program the redundant bandwidth so we can bypass the SSL bandwidth!', 1, 2, true),
	('program redundant circuit', 'You can''t navigate the matrix without transmitting the open-source SSL array!', 2, 2, true),
	('quantify auxiliary transmitter', null, 2, 2, true),
	('override wireless matrix', null, 2, 2, false),
	('input digital array', null, 2, 2, true),
	('copy mobile protocol', 'I''ll connect the 1080p ADP feed, that should driver the CSS firewall!', 2, 1, false),
	('input auxiliary alarm', null, 1, 2, true),
	('override open-source program', null, 2, 1, false),
	('connect optical monitor', 'Try to index the SCSI matrix, maybe it will compress the 1080p array!', 1, 2, true),
	('index haptic port', null, 1, 1, true),
	('quantify 1080p bus', 'You can''t index the bus without overriding the mobile JBOD card!', 2, 2, true),
	('program optical monitor', 'We need to calculate the redundant SAS transmitter!', 2, 1, false),
	('parse mobile bus', null, 1, 1, false),
	('compress mobile matrix', null, 1, 2, false),
	('hack auxiliary monitor', null, 2, 1, true),
	('compress virtual microchip', null, 1, 2, false),
	('bypass mobile panel', null, 1, 1, true),
	('override 1080p microchip', null, 1, 1, false),
	('back up wireless array', 'You can''t parse the bandwidth without quantifying the optical HDD array!', 2, 2, false),
	('parse digital matrix', null, 1, 1, true);
